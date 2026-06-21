import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { EnrollmentsListClient } from "@/components/instructor/enrollments-list-client";

export default async function InstructorEnrollmentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/login");
  }

  return <EnrollmentsListClient />;
}
