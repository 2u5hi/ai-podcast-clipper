"use server";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";
import { checkUpload, UPLOAD_CONTENT_TYPE } from "~/lib/uploads";
import { requireVerifiedUserId } from "~/server/accounts";
import { LIMITS, rateLimit } from "~/server/rate-limit";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db";

export async function generateUploadUrl(fileInfo: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<{
  success: boolean;
  signedUrl: string;
  key: string;
  uploadedFileId: string;
}> {
  const userId = await requireVerifiedUserId();
  if (!(await rateLimit(`jobs:user:${userId}`, LIMITS.jobsPerUser))) {
    throw new Error(
      "Too many uploads in the last hour. Please try again later.",
    );
  }

  const problem = checkUpload(fileInfo);
  if (problem) throw new Error(problem);

  const s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  // the extension is fixed rather than taken from the client's filename
  const key = `${uuidv4()}/original.mp4`;

  // ContentLength is signed, so S3 refuses a body of any other size than the one checked above
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: UPLOAD_CONTENT_TYPE,
    ContentLength: fileInfo.size,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 600,
    signableHeaders: new Set(["content-length", "content-type"]),
  });

  const uploadedFileDbRecord = await db.uploadedFile.create({
    data: {
      userId,
      s3Key: key,
      displayName: fileInfo.filename.slice(0, 200),
      uploaded: false,
    },
    select: {
      id: true,
    },
  });

  return {
    success: true,
    signedUrl,
    key,
    uploadedFileId: uploadedFileDbRecord.id,
  };
}
