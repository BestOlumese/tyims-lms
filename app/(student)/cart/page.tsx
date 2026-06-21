import CartClient from "@/components/students/CartClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";

export const metadata = { title: "Shopping Cart" };

export default function CartPage() {
  return (
    <>
      <PageTitle pageName="Shopping Cart" parentHref="/courses" parentLabel="Courses" />
      <CartClient />
    </>
  );
}
