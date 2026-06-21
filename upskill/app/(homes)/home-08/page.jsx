import Brands from "@/upskill/components/common/Brands";
import Pricing from "@/upskill/components/common/Pricing";
import Footer1 from "@/upskill/components/footers/Footer1";
import Header8 from "@/upskill/components/headers/Header8";

import Countdown from "@/upskill/components/homes/home-8/Countdown";
import Courses from "@/upskill/components/homes/home-8/Courses";
import Facts from "@/upskill/components/homes/home-8/Facts";
import Faqs from "@/upskill/components/homes/home-8/Faqs";
import GetStarted from "@/upskill/components/homes/home-8/GetStarted";
import Hero from "@/upskill/components/homes/home-8/Hero";
import Languages from "@/upskill/components/homes/home-8/Languages";
import NewsLetter from "@/upskill/components/homes/home-8/NewsLetter";
import Teachers from "@/upskill/components/homes/home-8/Teachers";
import Testimonials from "@/upskill/components/homes/home-8/Testimonials";
import React from "react";

export const metadata = {
  title:
    "Home 8 || UpSkill - Education Online Courses LMS React Nextjs Template",
  description: "UpSkill - Education Online Courses LMS React Nextjs Template",
};
export default function page() {
  return (
    <>
      <div id="wrapper">
        <div className="tf-top-bar flex items-center justify-center">
          <p>Intro price. Get UpSkill for Big Sale -95% off.</p>
        </div>

        <Header8 />
        <Hero />
        <div className="main-content pt-0">
          <Languages />
          <GetStarted />
          <Facts />
          <Courses />
          <Testimonials />
          <Teachers />
          <Brands />
          <Countdown />
          <Pricing />
          <Faqs />
          <NewsLetter />
        </div>
        <Footer1 parentClass="footer pt-66" />
      </div>
    </>
  );
}
