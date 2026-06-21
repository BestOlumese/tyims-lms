import Brands from "@/upskill/components/common/Brands";
import Instractors from "@/upskill/components/homes/home-1/Instractors";
import Testimonials from "@/upskill/components/homes/home-1/Testimonials";
import About from "@/upskill/components/otherPages/about/About";
import Banner from "@/upskill/components/otherPages/about/Banner";
import Facts from "@/upskill/components/otherPages/about/Facts";
import Features from "@/upskill/components/otherPages/about/Features";
import OurVisions from "@/upskill/components/otherPages/about/OurVisions";
import Link from "next/link";
import React from "react";

export const metadata = {
  title: "About Us | TYIMS LMS",
  description: "Learn more about TYIMS LMS",
};

export default function AboutPage() {
  return (
    <>
      <div className="page-title basic">
        <div className="tf-container full">
          <div className="row">
            <div className="col-12">
              <div className="content text-center">
                <ul className="breadcrumbs flex items-center justify-center gap-10">
                  <li>
                    <Link href={`/`} className="flex">
                      <i className="icon-home" />
                    </Link>
                  </li>
                  <li>
                    <i className="icon-arrow-right" />
                  </li>
                  <li>About Us</li>
                </ul>
                <h2 className="font-cardo fw-7">About Us</h2>
                <h6>
                  Empowering learning and teaching around the globe.
                </h6>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content pt-0">
        <About />
        <Features />
        <OurVisions />
        <Facts />
        <Testimonials parentClass="tf-spacing-5 widget-saying bg-4 page-about" />
        <div className="tf-spacing-5 pt-0"></div>
        <Instractors />
        <Brands />
        <Banner />
      </div>
    </>
  );
}
