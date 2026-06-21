import CourseDetailClient from "@/components/students/CourseDetailClient";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, id));
  return {
    title: course ? `${course.title} | TYIMS LMS` : "Course Details | TYIMS LMS",
    description: "Course details and curriculum",
  };
}

export default async function CourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="main-content pt-0">
      <CourseDetailClient courseId={id} />
    </div>
  );
}
