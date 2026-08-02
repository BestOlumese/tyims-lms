// ROOT LAYOUT for the public template shell. See components/root-shell.tsx for why this
// app has several root layouts instead of one.
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
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  title: "TYIMS LMS",
  description: "A modern learning management system",
};

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // The header's category dropdown and the mobile menu both read getPublicCategories.
  // Prefetching here means the markup is complete in the first HTML response.
  await queryClient.prefetchQuery(orpcServerPublic.getPublicCategories.queryOptions());

  return (
    <RootShell>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CartProvider>
          <TemplateWrapper>
            <div id="wrapper">
              <div className="tf-top-bar flex items-center justify-center">
                <p>Intro price. Get UpSkill for Big Sale -95% off.</p>
              </div>
              <Header1 />
              {children}
              <Footer1 />
            </div>
          </TemplateWrapper>
        </CartProvider>
      </HydrationBoundary>
    </RootShell>
  );
}
