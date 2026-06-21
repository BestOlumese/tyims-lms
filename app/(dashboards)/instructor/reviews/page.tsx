import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { ReviewsListClient } from "@/components/instructor/reviews-list-client";

export default async function InstructorReviewsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return redirect("/login");
  }

  return <ReviewsListClient />;
}
