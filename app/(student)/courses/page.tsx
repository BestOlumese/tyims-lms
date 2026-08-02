import CourseListClient from "@/components/students/CourseListClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";
import { call } from "@orpc/server";
import { appRouter } from "@/server/api/root";

export const metadata = {
  title: "Courses | TYIMS LMS",
  description: "Browse all courses",
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

/**
 * Server-render the exact same procedure the client re-queries after hydration.
 *
 * This used to be a hand-written Drizzle query that had drifted from getPublicCourses:
 * it was missing the `status = PUBLISHED` filter (so unpublished drafts appeared on the
 * first paint) and it returned a narrower row shape (no rating, lesson count or
 * discount price), which made every card visibly re-flow once the client query resolved.
 * Calling the procedure directly keeps the two permanently in sync.
 */
async function fetchInitialCourses() {
  try {
    return await call(
      appRouter.getPublicCourses,
      { page: 1, pageSize: 12, sort: "newest" },
      { context: { user: null } },
    );
  } catch {
    return null;
  }
}

export default async function CoursesPage({ searchParams }: Props) {
  const { q } = await searchParams;
  // CourseListClient only accepts initialData when no search term is active,
  // so don't bother fetching it for a search request.
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
