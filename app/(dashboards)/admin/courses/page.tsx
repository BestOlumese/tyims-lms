import { db } from "@/lib/db";
import { courses as coursesTable, users, categories } from "@/lib/db/schema";
import CoursesClient from "@/components/admin/courses-client";
import { desc, eq } from "drizzle-orm";

export const metadata = {
  title: "Course Management | Admin",
  description: "Monitor and manage all courses across the platform.",
};

export default async function AdminCoursesPage() {
  // Pre-fetch all courses with instructor and category details for instant loading
  const courses = await db
    .select({
      id: coursesTable.id,
      title: coursesTable.title,
      price: coursesTable.price,
      status: coursesTable.status,
      createdAt: coursesTable.createdAt,
      instructorName: users.name,
      categoryName: categories.name,
    })
    .from(coursesTable)
    .leftJoin(users, eq(coursesTable.instructorId, users.id))
    .leftJoin(categories, eq(coursesTable.categoryId, categories.id))
    .orderBy(desc(coursesTable.createdAt));

  return <CoursesClient initialData={courses} />;
}
