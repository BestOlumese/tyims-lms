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

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="main-content pb-63">
        <HomeCourses />
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
    </>
  );
}
