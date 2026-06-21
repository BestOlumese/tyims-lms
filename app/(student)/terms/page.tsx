import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions | TYIMS LMS",
  description: "Terms and conditions of use",
};

export default function TermsPage() {
  return (
    <>
      <div className="page-title page-title-terms">
        <div className="tf-container">
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
                  <li>Terms &amp; Conditions</li>
                </ul>
                <h2 className="font-cardo fw-7">Terms &amp; Conditions</h2>
                <h6>Please read these terms carefully before using our platform.</h6>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content pt-0">
        <section className="section-page-terms">
          <div className="tf-container">
            <div className="row">
              <div className="col-12">
                <div className="content">
                  <div className="basic-terms">
                    <h2 className="text-22 fw-5 font-outfit wow fadeInUp" data-wow-delay="0s">
                      Basic Terms
                    </h2>
                    <p className="text-1 fs-15 wow fadeInUp" data-wow-delay="0s">
                      By accessing this website, we assume you accept these terms and conditions. Do not continue to use TYIMS LMS if you do not agree to take all of the terms and conditions stated on this page.
                    </p>
                  </div>
                  <div className="right-and-restriction">
                    <h2 className="text-22 fw-5 font-outfit wow fadeInUp" data-wow-delay="0s">
                      Rights &amp; Restrictions
                    </h2>
                    <ul className="list-text">
                      <li className="item-text fs-15 wow fadeInUp" data-wow-delay="0s">
                        You must not republish material from TYIMS LMS.
                      </li>
                      <li className="item-text fs-15 wow fadeInUp" data-wow-delay="0s">
                        You must not sell, rent, or sub-license material from TYIMS LMS.
                      </li>
                      <li className="item-text fs-15 wow fadeInUp" data-wow-delay="0s">
                        You must not reproduce, duplicate or copy material from TYIMS LMS.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
