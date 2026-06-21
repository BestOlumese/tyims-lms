import Footer1 from "@/upskill/components/footers/Footer1";
import Header1 from "@/upskill/components/headers/Header1";
import Banner from "@/upskill/components/homes/home-1/Banner";
import Banner2 from "@/upskill/components/homes/home-1/Banner2";
import BecomeInstactor from "@/upskill/components/homes/home-1/BecomeInstactor";
import Blogs from "@/upskill/components/homes/home-1/Blogs";
import Brands from "@/upskill/components/common/Brands";
import Courses from "@/upskill/components/common/Courses";
import Facts from "@/upskill/components/homes/home-1/Facts";
import Features from "@/upskill/components/homes/home-1/Features";
import Hero from "@/upskill/components/homes/home-1/Hero";
import Instractors from "@/upskill/components/homes/home-1/Instractors";
import Testimonials from "@/upskill/components/homes/home-1/Testimonials";

export const metadata = {
  title:
    "Home 1 || UpSkill - Education Online Courses LMS React Nextjs Template",
  description: "UpSkill - Education Online Courses LMS React Nextjs Template",
};
export default function HomePage1() {
  return (
    <>
      <div id="wrapper">
        <div className="tf-top-bar flex items-center justify-center">
          <p>Intro price. Get UpSkill for Big Sale -95% off.</p>
        </div>

        <Header1 />
        <Hero />
        <div className="main-content pb-63">
          <Courses />
          <Features />
          <Facts />
          <Testimonials />
          <Banner />
          <Instractors />
          <BecomeInstactor />
          <Blogs />
          <Brands />
          <Banner2 />
        </div>
        <Footer1 />
      </div>
    </>
  );
}
