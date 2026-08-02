import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { orpcServerPublic } from "@/lib/orpc-server";
import InstructorListClient from "@/components/students/InstructorListClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";

export const metadata = { title: "Instructors | TYIMS LMS" };

// Public and identical for every visitor → prerender, refresh in the background.
export const revalidate = 300;

export default async function InstructorsPage() {
  const queryClient = getQueryClient();

  // This page previously did NO server-side fetching at all: it shipped an empty shell,
  // hydrated, then fetched. The input below must match InstructorListClient's initial
  // state exactly (page 1, PAGE_SIZE 15, sort "default", no search) — otherwise the
  // cache key differs and the client refetches anyway, defeating the prefetch.
  await queryClient.prefetchQuery(
    orpcServerPublic.getPublicInstructors.queryOptions({
      input: { page: 1, pageSize: 15, sort: "default" },
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PageTitle pageName="Instructors" parentHref="/instructors" parentLabel="Instructors" />
      <div className="main-content pt-0">
        <InstructorListClient />
      </div>
    </HydrationBoundary>
  );
}
