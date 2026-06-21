import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "@/server/api/root"; 
import type { RouterClient } from "@orpc/server"; 

// 1. Initialize the Base Fetch Client
const link = new RPCLink({
  url: typeof window !== "undefined" 
    ? `${window.location.origin}/api/orpc` 
    : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/orpc",
});

// 2. Wrap AppRouter in RouterClient to satisfy the strict constraint
const client = createORPCClient<RouterClient<AppRouter>>(link);

// 3. Export the Tanstack Query Utilities
export const orpc = createTanstackQueryUtils(client);
