"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  // getQueryClient() returns the browser singleton here, built from the same
  // makeQueryClient() factory the server uses to dehydrate. Keeping one factory
  // means server-prefetched data isn't treated as stale the moment it hydrates.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
