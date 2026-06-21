import CheckoutClient from "@/components/students/CheckoutClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";

export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <>
      <PageTitle pageName="Checkout" parentHref="/cart" parentLabel="Cart" breadcrumbs={[{ label: "Checkout" }]} />
      <CheckoutClient />
    </>
  );
}
