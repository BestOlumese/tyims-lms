import CourseListClient from "@/components/students/CourseListClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";
import { db } from "@/lib/db";
import { courses, users, categories } from "@/lib/db/schema";
import { desc, eq, count } from "drizzle-orm";

export const metadata = {
  title: "Courses | TYIMS LMS",
  description: "Browse all courses",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

async function fetchInitialCourses() {
  try {
    const pageSize = 12;
    const [{ value: total }] = await db.select({ value: count() }).from(courses);
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        price: courses.price,
        thumbnailUrl: courses.thumbnailUrl,
        instructorName: users.name,
        categoryName: categories.name,
      })
      .from(courses)
      .leftJoin(users, eq(courses.instructorId, users.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .orderBy(desc(courses.createdAt))
      .limit(pageSize);
    return { total: total || 0, page: 1, pageSize, data: rows };
  } catch {
    return null;
  }
}

export default async function CoursesPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const initialData = q ? null : await fetchInitialCourses();

  return (
    <>
      <PageTitle pageName="Courses" />
      <div className="main-content pt-0">
        <CourseListClient initialData={initialData} initialQ={q || ""} />
      </div>
    </>
  );
}
