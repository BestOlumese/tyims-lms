// ROOT LAYOUT for the Tailwind dashboards.
//
// Separate from the template shell on purpose: Next.js forces a full page load when
// navigating across root layouts, which stops the Bootstrap/Upskill stylesheet and
// Tailwind from ever coexisting in the same document. See components/root-shell.tsx.
import "../globals.css";
import "./dashboard.css";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RootShell } from "@/components/root-shell";

export const metadata: Metadata = {
  title: "Dashboard | TYIMS LMS",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <RootShell>{children}</RootShell>;
}
