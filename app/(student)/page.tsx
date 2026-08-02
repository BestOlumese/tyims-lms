import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { call } from "@orpc/server";
import { appRouter } from "@/server/api/root";
import { getQueryClient } from "@/lib/query-client";
import { orpcServerPublic } from "@/lib/orpc-server";

import Banner from "@/upskill/components/homes/home-1/Banner";
import Banner2 from "@/upskill/components/homes/home-1/Banner2";
import BecomeInstactor from "@/upskill/components/homes/home-1/BecomeInstactor";
import Blogs from "@/upskill/components/homes/home-1/Blogs";
import Brands from "@/upskill/components/common/Brands";
import Facts from "@/upskill/components/homes/home-1/Facts";
import Features from "@/upskill/components/homes/home-1/Features";
import Hero from "@/upskill/components/homes/home-1/Hero";
import Instractors from "@/upskill/components/homes/home-1/Instractors";
import Testimonials from "@/upskill/components/homes/home-1/Testimonials";
import HomeCourses from "@/components/students/HomeCourses";

export const metadata = {
  title: "TYIMS LMS | Home",
  description: "Modern learning management system.",
};

// The homepage is public and identical for everyone, so it is prerendered at build time
// and refreshed in the background every 5 minutes. Nothing in this render path touches
// headers() or cookies(), which is what keeps static generation possible.
export const revalidate = 300;

export default async function HomePage() {
  const queryClient = getQueryClient();

  // Both run in parallel, and in-process — no HTTP hop back into our own API route.
  const [featuredInstructors] = await Promise.all([
    call(appRouter.getFeaturedInstructors, { limit: 8 }, { context: { user: null } }),
    // HomeCourses is a client component using useQuery. Prefetching here means it
    // renders with data on first paint instead of mounting empty and then fetching.
    queryClient.prefetchQuery(
      orpcServerPublic.getPublicCourses.queryOptions({
        input: { page: 1, pageSize: 10, sort: "newest" },
      }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Hero />
      <div className="main-content pb-63">
        <HomeCourses />
        <Features />
        <Facts />
        <Testimonials />
        <Banner />
        <Instractors instructors={featuredInstructors} />
        <BecomeInstactor />
        <Blogs />
        <Brands />
        <Banner2 />
      </div>
    </HydrationBoundary>
  );
}
