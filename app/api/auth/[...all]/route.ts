import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth"; // Point this to the auth.ts file we created earlier

export const { GET, POST } = toNextJsHandler(auth.handler);