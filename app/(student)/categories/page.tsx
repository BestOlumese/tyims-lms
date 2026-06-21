import PageTitle from "@/upskill/components/course-list/PageTitle";
import CategoriesList from "@/components/students/CategoriesList";

export const metadata = {
  title: "Categories | TYIMS LMS",
  description: "Browse courses by category",
};

export default function CategoriesPage() {
  return (
    <>
      <PageTitle pageName="Categories" />
      <CategoriesList />
    </>
  );
}
