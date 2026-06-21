import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { CourseQuizzesClient } from "@/components/instructor/course-quizzes-client";

export default async function InstructorCourseQuizzesPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  const resolvedParams = await params;

  return <CourseQuizzesClient courseId={resolvedParams.courseId} />;
}
