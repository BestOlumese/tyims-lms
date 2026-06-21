import Brands from "@/upskill/components/common/Brands";
import Header5 from "@/upskill/components/headers/Header5";
import Faqs from "@/upskill/components/homes/home-5/Faqs";
import Blogs from "@/upskill/components/homes/home-5/Blogs";
import Courses from "@/upskill/components/homes/home-5/Courses";
import Features from "@/upskill/components/homes/home-5/Features";
import GetStarted from "@/upskill/components/homes/home-5/GetStarted";
import Hero from "@/upskill/components/homes/home-5/Hero";
import Instractors from "@/upskill/components/homes/home-5/Instractors";
import Testimonials from "@/upskill/components/homes/home-5/Testimonials";
import React from "react";
import WidgetInstagram from "@/upskill/components/homes/home-5/WidgetInstagram";
import Footer1 from "@/upskill/components/footers/Footer1";

export const metadata = {
  title:
    "Home 5 || UpSkill - Education Online Courses LMS React Nextjs Template",
  description: "UpSkill - Education Online Courses LMS React Nextjs Template",
};
export default function page() {
  return (
    <>
      <div id="wrapper">
        <Header5 />
        <Hero />
        <div className="main-content pt-0">
          <Features />
          <Courses />
          <GetStarted />
          <Testimonials />
          <Instractors />
          <Brands />
          <Blogs />

          <Faqs />
          <WidgetInstagram />
        </div>
        <div className="pt-66"></div>
        <Footer1 />
      </div>
    </>
  );
}
