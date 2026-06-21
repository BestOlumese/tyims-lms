import { Suspense } from "react";
import StudentDashboardClient from "@/components/students/StudentDashboardClient";

export const metadata = {
  title: "Dashboard | TYIMS LMS",
};

export default function DashboardPage() {
  return (
    <Suspense>
      <StudentDashboardClient />
    </Suspense>
  );
}
