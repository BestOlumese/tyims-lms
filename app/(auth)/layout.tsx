// ROOT LAYOUT for the login/register pages (template shell).
// See components/root-shell.tsx for why this app has several root layouts.
import "../globals.css";
import "../template-theme.css";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { orpcServerPublic } from "@/lib/orpc-server";
import { RootShell } from "@/components/root-shell";
import TemplateWrapper from "@/components/upskill/TemplateWrapper";
import Header1 from "@/upskill/components/headers/Header1";
import Footer1 from "@/upskill/components/footers/Footer1";

export const metadata: Metadata = {
  title: "TYIMS LMS",
  description: "A modern learning management system",
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(orpcServerPublic.getPublicCategories.queryOptions());

  return (
    <RootShell>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TemplateWrapper>
          <div id="wrapper">
            <Header1 />
            {children}
            <Footer1 />
          </div>
        </TemplateWrapper>
      </HydrationBoundary>
    </RootShell>
  );
}
