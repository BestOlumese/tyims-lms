import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { AssessmentsListClient } from "@/components/instructor/assessments-list-client";

export default async function InstructorAssessmentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return <AssessmentsListClient />;
}
