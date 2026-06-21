import Brands from "@/upskill/components/common/Brands";
import Header4 from "@/upskill/components/headers/Header4";
import Testimonials from "@/upskill/components/homes/home-4/Testimonials";
import AboutUs from "@/upskill/components/homes/home-4/AboutUs";
import Courses from "@/upskill/components/homes/home-4/Courses";
import Facts from "@/upskill/components/homes/home-4/Facts";
import Features from "@/upskill/components/homes/home-4/Features";
import Hero from "@/upskill/components/homes/home-4/Hero";
import React from "react";
import Instractors from "@/upskill/components/homes/home-4/Instractors";
import Faqs from "@/upskill/components/homes/home-4/Faqs";
import Blogs from "@/upskill/components/common/Blogs";
import DownloadApp from "@/upskill/components/homes/home-4/DownloadApp";
import Footer1 from "@/upskill/components/footers/Footer1";

export const metadata = {
  title:
    "Home 4 || UpSkill - Education Online Courses LMS React Nextjs Template",
  description: "UpSkill - Education Online Courses LMS React Nextjs Template",
};
export default function page() {
  return (
    <>
      <div id="wrapper">
        <Header4 />
        <Hero />
        <div className="main-content pt-0">
          <Brands />
          <Features />
          <Courses />
          <AboutUs />
          <Facts />
          <Testimonials />
          <Instractors />
          <Faqs />
          <Blogs />
          <DownloadApp />
        </div>
        <Footer1 />
      </div>
    </>
  );
}
