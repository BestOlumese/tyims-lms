import Header3 from "@/upskill/components/headers/Header3";
import Brands from "@/upskill/components/common/Brands";
import Categories from "@/upskill/components/homes/home-3/Categories";
import Hero from "@/upskill/components/homes/home-3/Hero";
import React from "react";
import Courses from "@/upskill/components/homes/home-3/Courses";
import GetStarted from "@/upskill/components/homes/home-3/GetStarted";
import Facts from "@/upskill/components/homes/home-3/Facts";
import Instractor from "@/upskill/components/homes/home-3/Instractor";
import Events from "@/upskill/components/homes/home-3/Events";
import Banner from "@/upskill/components/homes/home-3/Banner";
import Blogs from "@/upskill/components/homes/home-3/Blogs";
import Newsletter from "@/upskill/components/homes/home-3/Newsletter";
import Footer1 from "@/upskill/components/footers/Footer1";

export const metadata = {
  title:
    "Home 3 || UpSkill - Education Online Courses LMS React Nextjs Template",
  description: "UpSkill - Education Online Courses LMS React Nextjs Template",
};
export default function page() {
  return (
    <>
      <div id="wrapper">
        <div className="tf-top-bar style-1 flex items-center justify-center">
          <p>Intro price. Get UpSkill for Big Sale -95% off.</p>
        </div>

        <Header3 />
        <Hero />
        <div className="main-content pb-182">
          <Categories />
          <Brands />
          <Courses />
          <GetStarted />
          <Facts />
          <Instractor />
          <Events />
          <Banner />
          <Blogs />
          <Newsletter />
        </div>
        <Footer1 parentClass="footer style-3" />
      </div>
    </>
  );
}
