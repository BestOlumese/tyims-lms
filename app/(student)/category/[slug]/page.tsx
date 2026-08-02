import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { call } from "@orpc/server";
import { appRouter } from "@/server/api/root";
import CourseListClient from "@/components/students/CourseListClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [cat] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.slug, slug));
  return { title: `${cat?.name ?? slug} — Category | TYIMS LMS` };
}

/**
 * Server-render the exact same procedure the client re-queries after hydration.
 * See the note in app/(student)/courses/page.tsx — the hand-written query this
 * replaced returned a narrower row shape than getPublicCourses, so every card
 * re-flowed once the client query resolved.
 */
async function fetchCategoryInitialData(categoryId: string) {
  try {
    return await call(
      appRouter.getPublicCourses,
      { page: 1, pageSize: 12, sort: "newest", categoryIds: [categoryId] },
      { context: { user: null } },
    );
  } catch {
    return null;
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug));

  // Previously an unknown slug rendered an empty page titled "Category".
  if (!cat) notFound();

  const initialData = await fetchCategoryInitialData(cat.id);

  return (
    <>
      <PageTitle
        pageName={cat.name}
        breadcrumbs={[{ label: cat.name }]}
      />
      <div className="main-content pt-0">
        <CourseListClient
          initialCategoryId={cat.id}
          initialData={initialData}
          hideCategoryFilter={true}
        />
      </div>
    </>
  );
}
