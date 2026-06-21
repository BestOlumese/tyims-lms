import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { inngest } from "@/lib/inngest/client";
import { z } from "zod";

const f = createUploadthing();

const handleAuth = async () => {
  console.log("[UPLOADTHING] handleAuth called");
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    console.log("[UPLOADTHING] Session found:", !!session, "Role:", session?.user?.role);

    if (
      !session ||
      (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")
    ) {
      console.log("[UPLOADTHING] Unauthorized access attempt");
      throw new UploadThingError("Unauthorized");
    }

    return { userId: session.user.id };
  } catch (error) {
    console.error("[UPLOADTHING] handleAuth error:", error);
    throw new UploadThingError("Authentication failed");
  }
};

export const ourFileRouter = {
  courseImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
        console.log("[UPLOADTHING] Middleware for courseImage started");
        return await handleAuth();
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url };
    }),
  courseAttachment: f({
    text: { maxFileCount: 1 },
    image: { maxFileCount: 1 },
    audio: { maxFileCount: 1 },
    pdf: { maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
        console.log("[UPLOADTHING] Middleware for courseAttachment started");
        return await handleAuth();
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.url };
    }),
  chapterVideo: f({ video: { maxFileCount: 1, maxFileSize: "512GB" } })
    .input(z.object({ lessonId: z.string() }))
    .middleware(async ({ input }) => {
      const authData = await handleAuth();
      return { ...authData, lessonId: input.lessonId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log(`[UPLOADTHING] chapterVideo upload complete for lesson ${metadata.lessonId}`);
      console.log(`[UPLOADTHING] File URL: ${file.url}`);
      
      // Trigger Inngest to process the video with Mux
      try {
        await inngest.send({
          name: "video/uploaded",
          data: {
            userId: metadata.userId,
            lessonId: metadata.lessonId,
            videoUrl: file.url,
            videoName: file.name,
          },
        });
        console.log(`[UPLOADTHING] Inngest event 'video/uploaded' sent successfully`);
      } catch (error) {
        console.error(`[UPLOADTHING] Failed to send Inngest event:`, error);
      }
      
      return { lessonId: metadata.lessonId, url: file.url };
    }),
  test: f({ image: { maxFileCount: 1 } })
    .onUploadComplete(async ({ file }) => {
      console.log("[UPLOADTHING] Test upload complete:", file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
