import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { QuizDetailsClient } from "@/components/instructor/quiz-details-client";

export default async function InstructorQuizDetailsPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  const resolvedParams = await params;

  return <QuizDetailsClient courseId={resolvedParams.courseId} quizId={resolvedParams.quizId} />;
}
