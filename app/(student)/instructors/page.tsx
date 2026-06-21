import InstructorListClient from "@/components/students/InstructorListClient";
import PageTitle from "@/upskill/components/course-list/PageTitle";

export const metadata = { title: "Instructors | TYIMS LMS" };

export default function InstructorsPage() {
  return (
    <>
      <PageTitle pageName="Instructors" parentHref="/instructors" parentLabel="Instructors" />
      <div className="main-content pt-0">
        <InstructorListClient />
      </div>
    </>
  );
}
