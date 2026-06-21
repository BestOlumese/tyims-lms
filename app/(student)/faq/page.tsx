import Brands from "@/upskill/components/common/Brands";
import Faq1 from "@/upskill/components/otherPages/faq/Faq1";
import Faq2 from "@/upskill/components/otherPages/faq/Faq2";
import Link from "next/link";
import React from "react";

export const metadata = {
  title: "FAQ | TYIMS LMS",
  description: "Frequently asked questions",
};

export default function FAQPage() {
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
                  <li>FAQ</li>
                </ul>
                <h2 className="font-cardo fw-7">Frequently Asked Questions</h2>
                <h6>Find answers to your questions below.</h6>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content pt-0">
        <div className="tf-spacing-25 pb-0">
          <Faq1 />
          <Faq2 />
          <div className="tf-spacing-24 pt-0"></div>
          <Brands />
        </div>
      </div>
    </>
  );
}
