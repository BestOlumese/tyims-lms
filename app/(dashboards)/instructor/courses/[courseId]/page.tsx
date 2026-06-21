import { db } from "@/lib/db";
import { courses, categories } from "@/lib/db/schema";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import CourseEditClient from "@/components/instructor/course-edit-client";

export default async function CourseEditPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/sign-in");
  }

  const course = await db.query.courses.findFirst({
    where: and(
      eq(courses.id, courseId),
      eq(courses.instructorId, session.user.id)
    ),
    with: {
      chapters: {
        orderBy: (chapters, { asc }) => [asc(chapters.orderIndex)],
        with: {
          lessons: {
            orderBy: (lessons, { asc }) => [asc(lessons.orderIndex)],
          }
        }
      }
    }
  });

  if (!course) {
    return redirect("/instructor/courses");
  }

  const allCategories = await db.select().from(categories);

  return (
    <CourseEditClient 
      initialCourse={course} 
      categories={allCategories} 
    />
  );
}
