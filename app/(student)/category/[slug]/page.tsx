import { db } from "@/lib/db";
import { categories, courses, users } from "@/lib/db/schema";
import { eq, desc, count, sql, and } from "drizzle-orm";
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

async function fetchCategoryInitialData(categoryId: string) {
  try {
    const pageSize = 12;
    const publishedInCategory = and(
      eq(courses.status, "PUBLISHED"),
      sql`${courses.categoryId} = ${categoryId}`,
    );

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(courses)
      .where(publishedInCategory);

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
      .where(publishedInCategory)
      .orderBy(desc(courses.createdAt))
      .limit(pageSize);

    return { total: total || 0, page: 1, pageSize, data: rows };
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

  const initialCategoryId = cat?.id ?? null;
  const initialData = initialCategoryId
    ? await fetchCategoryInitialData(initialCategoryId)
    : null;

  return (
    <>
      <PageTitle
        pageName={cat?.name ?? "Category"}
        breadcrumbs={cat?.name ? [{ label: cat.name }] : []}
      />
      <div className="main-content pt-0">
        <CourseListClient
          initialCategoryId={initialCategoryId}
          initialData={initialData}
          hideCategoryFilter={true}
        />
      </div>
    </>
  );
}
