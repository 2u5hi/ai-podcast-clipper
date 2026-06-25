import { env } from "~/env";
import { inngest } from "./client";
import { db } from "~/server/db";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

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
  async ({ event, step }) => {
    const { uploadedFileId, youtubeUrl } = event.data as {
      uploadedFileId: string;
      userId: string;
      youtubeUrl?: string;
    };

    try {
      const { userId, credits, s3Key } = await step.run(
        "check-credits",
        async () => {
          const uploadedFile = await db.uploadedFile.findUniqueOrThrow({
            where: {
              id: uploadedFileId,
            },
            select: {
              user: {
                select: {
                  id: true,
                  credits: true,
                },
              },
              s3Key: true,
            },
          });

          return {
            userId: uploadedFile.user.id,
            credits: uploadedFile.user.credits,
            s3Key: uploadedFile.s3Key,
          };
        },
      );

      if (credits > 0) {
        await step.run("set-status-processing", async () => {
          await db.uploadedFile.update({
            where: {
              id: uploadedFileId,
            },
            data: {
              status: "processing",
            },
          });
        });

        const modalResponse = await step.fetch(env.PROCESS_VIDEO_ENDPOINT, {
          method: "POST",
          body: JSON.stringify({
            s3_key: s3Key,
            ...(youtubeUrl ? { youtube_url: youtubeUrl } : {}),
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.PROCESS_VIDEO_ENDPOINT_AUTH}`,
          },
        });

        if (!modalResponse.ok) {
          const errorText = await modalResponse.text();
          throw new Error(`Modal backend failed (${modalResponse.status}): ${errorText}`);
        }

        const { clipsFound } = await step.run(
          "create-clips-in-db",
          async () => {
            const folderPrefix = s3Key.split("/")[0]!;

            const allKeys = await listS3ObjectsByPrefix(folderPrefix);

            const clipKeys = allKeys.filter(
              (key): key is string =>
                key !== undefined && !key.endsWith("original.mp4"),
            );

            if (clipKeys.length > 0) {
              await db.clip.createMany({
                data: clipKeys.map((clipKey) => ({
                  s3Key: clipKey,
                  uploadedFileId,
                  userId,
                })),
              });
            }

            return { clipsFound: clipKeys.length };
          },
        );

        await step.run("deduct-credits", async () => {
          await db.user.update({
            where: {
              id: userId,
            },
            data: {
              credits: {
                decrement: Math.min(credits, clipsFound),
              },
            },
          });
        });

        await step.run("set-status-processed", async () => {
          await db.uploadedFile.update({
            where: {
              id: uploadedFileId,
            },
            data: {
              status: "processed",
            },
          });
        });
      } else {
        await step.run("set-status-no-credits", async () => {
          await db.uploadedFile.update({
            where: {
              id: uploadedFileId,
            },
            data: {
              status: "no credits",
            },
          });
        });
      }
    } catch (error: unknown) {
      // long videos can outlive the fetch window while Modal still finishes --
      // check S3 for clips before calling it a failure
      const recovered = await step.run("check-for-recovered-clips", async () => {
        const uploadedFile = await db.uploadedFile.findUniqueOrThrow({
          where: { id: uploadedFileId },
          select: { s3Key: true, userId: true },
        });
        const folderPrefix = uploadedFile.s3Key.split("/")[0]!;
        const allKeys = await listS3ObjectsByPrefix(folderPrefix);
        const clipKeys = allKeys.filter(
          (key): key is string =>
            key !== undefined && !key.endsWith("original.mp4"),
        );
        if (clipKeys.length === 0) return 0;

        const existing = await db.clip.findMany({
          where: { s3Key: { in: clipKeys } },
          select: { s3Key: true },
        });
        const existingKeys = new Set(existing.map((c) => c.s3Key));
        const newKeys = clipKeys.filter((k) => !existingKeys.has(k));
        if (newKeys.length > 0) {
          await db.clip.createMany({
            data: newKeys.map((clipKey) => ({
              s3Key: clipKey,
              uploadedFileId,
              userId: uploadedFile.userId,
            })),
          });
          await db.user.update({
            where: { id: uploadedFile.userId },
            data: { credits: { decrement: newKeys.length } },
          });
        }
        return clipKeys.length;
      });

      await db.uploadedFile.update({
        where: {
          id: uploadedFileId,
        },
        data: {
          status: recovered > 0 ? "processed" : "failed",
        },
      });
      if (recovered === 0) throw error;
    }
  },
);

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
