import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "@/server/api/root"; 
import type { RouterClient } from "@orpc/server"; 

/**
 * Absolute base URL for server-side calls. In the browser we always use the current
 * origin. On the server there is no origin, so we need an explicit one — without it
 * a deployed build silently tries to reach localhost:3000.
 *
 * Prefer calling procedures directly with `call()` from @orpc/server in Server
 * Components; this client is primarily for "use client" components.
 */
function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// 1. Initialize the Base Fetch Client
const link = new RPCLink({
  url: `${getBaseUrl()}/api/orpc`,
});

// 2. Wrap AppRouter in RouterClient to satisfy the strict constraint
const client = createORPCClient<RouterClient<AppRouter>>(link);

// 3. Export the Tanstack Query Utilities
export const orpc = createTanstackQueryUtils(client);
