import { db } from "@/lib/db";
import { categories as categoriesTable } from "@/lib/db/schema";
import CategoriesClient from "@/components/admin/categories-client";

export const metadata = {
  title: "Categories Management | Admin",
  description: "Manage course categories and hierarchy.",
};

export default async function AdminCategoriesPage() {
  // Fetch initial data on the server for instant loading
  const categories = await db.select().from(categoriesTable);

  return <CategoriesClient initialData={categories} />;
}
