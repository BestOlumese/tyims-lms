import { Cardo, DM_Sans, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "sonner";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";

/**
 * The <html>/<body> shell shared by every root layout.
 *
 * This app deliberately has MULTIPLE root layouts — one for the Bootstrap/Upskill template
 * shell and one for the Tailwind dashboards. Next.js forces a full page load when
 * navigating across root layouts, which is exactly what we need: the two CSS systems are
 * mutually destructive (Bootstrap + template ship ~2,100 `!important` declarations and
 * style bare elements like body/h1-h6/a/ul/button, and both define .flex / .items-center /
 * .hidden with different values).
 *
 * With a single shared root layout they were soft-navigations, and React never removes a
 * stylesheet it has hoisted — so arriving at /admin from the homepage left the template CSS
 * in the document and Tailwind appeared not to load until a manual refresh.
 *
 * Each root layout imports its OWN stylesheet and wraps children in this component. Do not
 * reintroduce a top-level app/layout.tsx — that would collapse them back into one root and
 * bring the bug back.
 */

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const cardo = Cardo({
  variable: "--font-cardo",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const fontVariables = `${dmSans.variable} ${cardo.variable} ${outfit.variable}`;

export function RootShell({
  children,
  bodyClassName,
}: {
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body className={bodyClassName}>
        <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
