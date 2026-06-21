import { RPCHandler } from "@orpc/server/fetch";
import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/api/context";

// Initialize the Fetch API handler
const handler = new RPCHandler(appRouter);

// Create a generic request handler for Next.js
export async function handleRequest(request: Request) {
  const { matched, response } = await handler.handle(request, {
    prefix: "/api/orpc",
    context: await createContext(), // Inject BetterAuth session here
  });

  return response ?? new Response("Not found", { status: 404 });
}

// Export the supported HTTP methods
export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;