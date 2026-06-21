import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { CourseReviewsDetailClient } from "@/components/instructor/course-reviews-detail-client";

export default async function InstructorCourseReviewsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/login");
  }

  const resolvedParams = await params;

  return <CourseReviewsDetailClient courseId={resolvedParams.courseId} />;
}
