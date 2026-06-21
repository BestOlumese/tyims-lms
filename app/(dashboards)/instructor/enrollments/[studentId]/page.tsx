import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { StudentDetailClient } from "@/components/instructor/student-detail-client";

export default async function InstructorStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/login");
  }

  const resolvedParams = await params;

  return <StudentDetailClient studentId={resolvedParams.studentId} />;
}
