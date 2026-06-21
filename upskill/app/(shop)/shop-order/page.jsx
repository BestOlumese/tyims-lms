import Footer1 from "@/upskill/components/footers/Footer1";
import Header1 from "@/upskill/components/headers/Header1";

import PageTitle from "@/upskill/components/shop/PageTitle";
import ShopOrder from "@/upskill/components/shop/ShopOrder";

import React from "react";

export const metadata = {
  title:
    "Shop Order || UpSkill - Education Online Courses LMS React Nextjs Template",
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
        <PageTitle />
        <ShopOrder />
        <Footer1 parentClass="footer has-border-top" />
      </div>
    </>
  );
}
