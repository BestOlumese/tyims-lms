import { db } from "@/lib/db";
import { courses, enrollments } from "@/lib/db/schema";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { eq, count, sql } from "drizzle-orm";
import InstructorOverview from "@/components/instructor/instructor-overview";
import { redirect } from "next/navigation";

export default async function InstructorPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/sign-in");
  }

  const instructorId = session.user.id;

  // 1. Total Courses
  const [courseStats] = await db
    .select({ value: count() })
    .from(courses)
    .where(eq(courses.instructorId, instructorId));

  // 2. Total Students & Revenue
  const instructorCourses = await db
    .select({ id: courses.id, price: courses.price })
    .from(courses)
    .where(eq(courses.instructorId, instructorId));

  const courseIds = instructorCourses.map(c => c.id);
  
  let totalStudents = 0;
  let totalRevenue = 0;

  if (courseIds.length > 0) {
    const allEnrollments = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(sql`${enrollments.courseId} IN ${courseIds}`);
    
    totalStudents = allEnrollments.length;
    
    allEnrollments.forEach(en => {
      const course = instructorCourses.find(c => c.id === en.courseId);
      if (course) totalRevenue += course.price;
    });
  }

  const initialData = {
    totalCourses: courseStats?.value || 0,
    totalStudents,
    totalRevenue,
  };

  return <InstructorOverview initialData={initialData} />;
}
