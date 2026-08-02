import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { appRouter } from "@/server/api/root";
import { createContext } from "@/server/api/context";

/**
 * SERVER-SIDE oRPC clients.
 *
 * `lib/orpc.ts` talks to `/api/orpc` over HTTP. That is correct in the browser, but in a
 * Server Component it would make the server issue an HTTP request to itself — an extra
 * network round-trip on every render, and a good way to exhaust the request pool.
 * These clients invoke the router in-process instead.
 *
 * Query keys are generated from the procedure path + input, not from the transport, so
 * anything prefetched here hydrates into the exact same cache entry the browser client
 * would have created.
 */

/**
 * PUBLIC client — context is a hardcoded `{ user: null }`.
 *
 * Deliberately does NOT call `createContext()`, because that reads `headers()`, and any
 * use of `headers()` opts the route out of static rendering. Using this on public pages
 * keeps them statically prerenderable (and ISR-able via `export const revalidate`).
 *
 * Only valid for `pub` procedures. Anything behind protectedProcedure will correctly
 * throw UNAUTHORIZED here.
 */
const publicServerClient = createRouterClient(appRouter, {
  context: { user: null },
});

export const orpcServerPublic = createTanstackQueryUtils(publicServerClient);

/**
 * SESSION client — resolves the real user from request headers.
 *
 * Use for authenticated Server Components. Note this forces dynamic rendering, which is
 * the correct trade-off for per-user pages but wrong for cacheable public ones.
 */
const sessionServerClient = createRouterClient(appRouter, {
  context: () => createContext(),
});

export const orpcServerSession = createTanstackQueryUtils(sessionServerClient);
