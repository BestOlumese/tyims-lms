// ROOT LAYOUT for /admin/login.
//
// The staff login can't live inside (dashboards) — that layout redirects anyone without a
// session, which would make the login page unreachable. It still needs the Tailwind
// stylesheet and its own <html>, so it gets its own root layout.
//
// No URL clash with (dashboards)/admin/*: this directory only contains `login`.
import "../globals.css";
import "../(dashboards)/dashboard.css";
import type { Metadata } from "next";
import { RootShell } from "@/components/root-shell";

export const metadata: Metadata = {
  title: "Staff sign in | TYIMS LMS",
};

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
