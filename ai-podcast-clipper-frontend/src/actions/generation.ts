"use server";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidatePath } from "next/cache";
import { env } from "~/env";
import { inngest } from "~/inngest/client";
import { canonicalYouTubeUrl, parseYouTubeVideoId } from "~/lib/youtube";
import { requireVerifiedUserId } from "~/server/accounts";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { LIMITS, rateLimit } from "~/server/rate-limit";
import { v4 as uuidv4 } from "uuid";

export async function processVideo(uploadedFileId: string) {
  const userId = await requireVerifiedUserId();

  // claim the file in one statement: only the owner, and only once
  const claimed = await db.uploadedFile.updateMany({
    where: { id: uploadedFileId, userId, uploaded: false },
    data: { uploaded: true },
  });
  if (claimed.count === 0) return;

  try {
    await inngest.send({
      name: "process-video-events",
      data: { uploadedFileId, userId },
    });
  } catch (error) {
    await db.uploadedFile.update({
      where: { id: uploadedFileId },
      data: { uploaded: false },
    });
    throw error;
  }

  revalidatePath("/dashboard");
}

// same flow as file uploads, but Modal downloads the source itself via youtube_url
export async function processYouTubeUrl(youtubeUrl: string) {
  const userId = await requireVerifiedUserId();

  if (!env.YOUTUBE_INGESTION_ENABLED) {
    throw new Error("YouTube links aren't available; upload the video instead");
  }
  if (!(await rateLimit(`jobs:user:${userId}`, LIMITS.jobsPerUser))) {
    throw new Error(
      "Too many videos in the last hour. Please try again later.",
    );
  }

  const videoId = parseYouTubeVideoId(youtubeUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");
  const canonicalUrl = canonicalYouTubeUrl(videoId);

  // a fresh prefix per job, so two users clipping the same video never share output
  const s3Key = `${uuidv4()}/original.mp4`;

  const uploadedFile = await db.uploadedFile.create({
    data: {
      s3Key,
      displayName: canonicalUrl,
      userId: userId,
      uploaded: true,
    },
  });

  await inngest.send({
    name: "process-video-events",
    data: {
      uploadedFileId: uploadedFile.id,
      userId: userId,
      youtubeUrl: canonicalUrl,
    },
  });

  revalidatePath("/dashboard");
}

export async function getClipPlayUrl(
  clipId: string,
): Promise<{ succes: boolean; url?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { succes: false, error: "Unauthorized" };
  }

  try {
    const clip = await db.clip.findUniqueOrThrow({
      where: {
        id: clipId,
        userId: session.user.id,
      },
    });

    const s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: clip.s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return { succes: true, url: signedUrl };
  } catch (error) {
    return { succes: false, error: "Failed to generate play URL." };
  }
}
