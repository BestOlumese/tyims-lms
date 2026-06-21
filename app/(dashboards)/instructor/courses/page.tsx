import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import MyCoursesClient from "@/components/instructor/my-courses-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "My Courses | Instructor Dashboard",
  description: "Manage your teaching content and track course performance.",
};

export default async function InstructorCoursesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/login");
  }

  // Pre-fetch instructor's courses on the server
  const instructorCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.instructorId, session.user.id))
    .orderBy(desc(courses.createdAt));

  return <MyCoursesClient initialData={instructorCourses} />;
}
