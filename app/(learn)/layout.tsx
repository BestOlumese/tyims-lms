// ROOT LAYOUT for the course player (template shell, no header/footer chrome).
// See components/root-shell.tsx for why this app has several root layouts.
import "../globals.css";
import "../template-theme.css";
import type { Metadata } from "next";
import { RootShell } from "@/components/root-shell";

export const metadata: Metadata = {
  title: "TYIMS LMS",
  description: "A modern learning management system",
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <RootShell>{children}</RootShell>;
}
