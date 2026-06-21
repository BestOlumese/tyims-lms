import CourseList3 from "@/upskill/components/course-list/CourseList3";
import Courses from "@/upskill/components/course-list/Courses";
import Instractors from "@/upskill/components/course-list/Instractors";
import PageTitle3 from "@/upskill/components/course-list/PageTitle3";
import Topics from "@/upskill/components/course-list/Topics";
import Footer1 from "@/upskill/components/footers/Footer1";
import Header1 from "@/upskill/components/headers/Header1";
import React from "react";

export const metadata = {
  title:
    "Course Category || UpSkill - Education Online Courses LMS React Nextjs Template",
  description: "UpSkill - Education Online Courses LMS React Nextjs Template",
};
export default function page() {
  return (
    <>
      <div id="wrapper">
        <div className="tf-top-bar flex items-center justify-center">
          <p>Intro price. Get UpSkill for Big Sale -95% off.</p>
        </div>
        <Header1 />
        <PageTitle3 />
        <div className="main-content pt-0">
          <Courses />
          <Topics />
          <Instractors />
          <CourseList3 />
        </div>
        <Footer1 />
      </div>
    </>
  );
}
