import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { type JobStatus } from "@prisma/client";
import { env } from "~/env";
import { failureReasonFor } from "~/lib/job-failures";
import { refundCredits, reserveCredits } from "~/server/credits";
import { db } from "~/server/db";
import { watermarkForJob } from "~/server/watermark";
import { inngest } from "./client";

// the most clips the pipeline makes from one video; also the most credits a job reserves
export const MAX_CLIPS_PER_JOB = 5;

type ProcessVideoEvent = {
  data: { uploadedFileId: string; userId: string; youtubeUrl?: string };
};

// the slice of Inngest's step API the job uses, so tests can run it without Inngest
type Steps = {
  run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
};

// Credits follow a reserve-then-settle pattern (ADR 0013): up to MAX_CLIPS_PER_JOB are reserved before
// any GPU work, Modal is told to make no more clips than were reserved, and whatever wasn't delivered
// is refunded — all of it when the job fails.
export async function runProcessVideo({
  event,
  step,
}: {
  event: ProcessVideoEvent;
  step: Steps;
}) {
  const { uploadedFileId, youtubeUrl } = event.data;
  let job:
    | {
        userId: string;
        s3Key: string;
        reserved: number;
        watermarkText: string | null;
      }
    | undefined;

  try {
    job = await step.run("reserve-credits", async () => {
      const file = await db.uploadedFile.findUniqueOrThrow({
        where: { id: uploadedFileId },
        select: { userId: true, s3Key: true },
      });
      const reserved = await db.$transaction((tx) =>
        reserveCredits(tx, {
          userId: file.userId,
          uploadedFileId,
          max: MAX_CLIPS_PER_JOB,
        }),
      );
      // decided once, with the reservation, so a replayed run brands its clips the same way
      const watermarkText = await watermarkForJob(file.userId);
      return {
        userId: file.userId,
        s3Key: file.s3Key,
        reserved,
        watermarkText,
      };
    });

    if (job.reserved === 0) {
      await step.run("set-status-no-credits", () =>
        setStatus(uploadedFileId, "NO_CREDITS"),
      );
      return;
    }

    await step.run("set-status-processing", () =>
      setStatus(uploadedFileId, "PROCESSING"),
    );

    const modalResponse = await step.fetch(env.PROCESS_VIDEO_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        s3_key: job.s3Key,
        max_clips: job.reserved,
        // null means no watermark (ADR 0016)
        watermark_text: job.watermarkText,
        ...(youtubeUrl ? { youtube_url: youtubeUrl } : {}),
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PROCESS_VIDEO_ENDPOINT_AUTH}`,
      },
    });

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      throw new Error(
        `Modal backend failed (${modalResponse.status}): ${errorText}`,
      );
    }

    const reservedJob = job;
    const delivered = await step.run("create-clips-in-db", () =>
      recordClips(uploadedFileId, reservedJob),
    );

    await step.run("settle-credits", () =>
      db.$transaction((tx) =>
        refundCredits(tx, {
          userId: reservedJob.userId,
          uploadedFileId,
          amount: reservedJob.reserved - delivered,
        }),
      ),
    );

    await step.run("set-status-processed", () =>
      setStatus(uploadedFileId, "PROCESSED"),
    );
  } catch (error: unknown) {
    const reservedJob = job;
    if (!reservedJob) {
      // failed before any credits were taken
      await step.run("set-status-failed", () =>
        setStatus(uploadedFileId, "FAILED", failureReasonFor(error)),
      );
      throw error;
    }

    // long videos can outlive the request while Modal still finishes, so
    // check S3 for clips before calling it a failure (ADR 0009)
    const delivered = await step.run("check-for-recovered-clips", () =>
      recordClips(uploadedFileId, reservedJob),
    );

    await step.run("settle-failed-job", async () => {
      await db.$transaction((tx) =>
        refundCredits(tx, {
          userId: reservedJob.userId,
          uploadedFileId,
          amount: reservedJob.reserved - delivered,
        }),
      );
      await (delivered > 0
        ? setStatus(uploadedFileId, "PROCESSED")
        : setStatus(uploadedFileId, "FAILED", failureReasonFor(error)));
    });

    if (delivered === 0) throw error;
  }
}

export const processVideo = inngest.createFunction(
  {
    id: "process-video",
    retries: 1,
    concurrency: {
      limit: 1,
      key: "event.data.userId",
    },
    triggers: [{ event: "process-video-events" }],
  },
  runProcessVideo,
);

async function setStatus(
  uploadedFileId: string,
  status: JobStatus,
  failureReason: string | null = null,
) {
  await db.uploadedFile.update({
    where: { id: uploadedFileId },
    data: { status, failureReason },
  });
}

// Records the job's clips found in S3, never more than were paid for; returns how many the job has.
async function recordClips(
  uploadedFileId: string,
  job: { userId: string; s3Key: string; reserved: number },
): Promise<number> {
  const folderPrefix = job.s3Key.split("/")[0]!;
  const allKeys = await listS3ObjectsByPrefix(`${folderPrefix}/`);
  const clipKeys = allKeys
    .filter(
      (key): key is string =>
        key !== undefined && !key.endsWith("original.mp4"),
    )
    .sort()
    .slice(0, job.reserved);

  const existing = await db.clip.findMany({
    where: { uploadedFileId },
    select: { s3Key: true },
  });
  const existingKeys = new Set(existing.map((clip) => clip.s3Key));
  const newKeys = clipKeys.filter((key) => !existingKeys.has(key));
  if (newKeys.length > 0) {
    await db.clip.createMany({
      data: newKeys.map((s3Key) => ({
        s3Key,
        uploadedFileId,
        userId: job.userId,
      })),
    });
  }
  return Math.min(existing.length + newKeys.length, job.reserved);
}

async function listS3ObjectsByPrefix(prefix: string) {
  const s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const listCommand = new ListObjectsV2Command({
    Bucket: env.S3_BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await s3Client.send(listCommand);
  return response.Contents?.map((item) => item.Key).filter(Boolean) ?? [];
}
