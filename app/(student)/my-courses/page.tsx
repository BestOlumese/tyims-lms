import { Suspense } from "react";
import StudentMyCoursesClient from "@/components/students/StudentMyCoursesClient";

export const metadata = {
  title: "My Courses | TYIMS LMS",
};

export default function MyCoursesPage() {
  return (
    <Suspense>
      <StudentMyCoursesClient />
    </Suspense>
  );
}
