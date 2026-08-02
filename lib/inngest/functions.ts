import { inngest } from "./client";
import { mux } from "@/lib/mux";
import { db } from "@/lib/db";
import { lessons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const processVideo = inngest.createFunction(
  {
    id: "process-video",
    triggers: [{ event: "video/uploaded" }],
  },
  async ({ event, step }) => {
    const videoUrl = event.data.videoUrl as string;
    const lessonId = event.data.lessonId as string;
    console.log(`[INNGEST] Processing video for lesson ${lessonId}: ${videoUrl}`);

    // 1. Create Mux Asset
    const asset = await step.run("create-mux-asset", async () => {
      console.log(`[INNGEST] Creating Mux asset...`);
      // `input` and `playback_policy` are both deprecated in @mux/mux-node v14;
      // the current names are `inputs` (required) and `playback_policies`.
      const newAsset = await mux.video.assets.create({
        inputs: [{ url: videoUrl }],
        playback_policies: ["public"],
      });
      console.log(`[INNGEST] Mux asset created: ${newAsset.id}`);
      return {
        id: newAsset.id,
        playbackId: newAsset.playback_ids?.[0]?.id ?? null,
      };
    });

    // 2. Update database with Mux details
    await step.run("update-lesson-db", async () => {
      console.log(`[INNGEST] Updating lesson ${lessonId} — MuxAssetId: ${asset.id}, PlaybackId: ${asset.playbackId}`);

      await db.update(lessons)
        .set({
          muxAssetId: asset.id,
          muxPlaybackId: asset.playbackId,
        })
        .where(eq(lessons.id, lessonId));

      console.log(`[INNGEST] Lesson ${lessonId} updated successfully`);
    });

    return { assetId: asset.id };
  }
);
