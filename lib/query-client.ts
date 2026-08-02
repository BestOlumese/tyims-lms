import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";
import { cache } from "react";

/**
 * One factory used by BOTH the server (for prefetch/dehydrate) and the browser
 * (in components/providers.tsx). Sharing it keeps the two configurations in sync —
 * if they drift, hydrated data can be considered stale immediately and refetched,
 * which silently undoes the whole point of prefetching.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that data prefetched on the server isn't refetched the
        // instant the client mounts.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        // Also ship queries that are still in-flight, so streaming/Suspense
        // handoff works instead of restarting the fetch on the client.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server: `cache()` gives one client per request, so several Server Components in
 * the same render share a cache and we dehydrate all of it at once.
 * Browser: a module-level singleton, so we never blow away the cache on re-render.
 */
const getServerQueryClient = cache(() => makeQueryClient());

export function getQueryClient() {
  if (isServer) return getServerQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
