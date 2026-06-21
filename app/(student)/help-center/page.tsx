import Faqs from "@/upskill/components/homes/home-4/Faqs";
import Services from "@/upskill/components/otherPages/help-center/Services";
import Link from "next/link";
import React from "react";

export const metadata = {
  title: "Help Center | TYIMS LMS",
  description: "Get help and support",
};

export default function HelpCenterPage() {
  return (
    <>
      <div className="page-title page-help">
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
                  <li>Help Center</li>
                </ul>
                <h2 className="font-cardo fw-7">Help Center</h2>
                <h6>
                  We're on a mission to deliver engaging, curated courses at a reasonable price.
                </h6>
                <form className="form-search-courses">
                  <div className="icon">
                    <i className="icon-keyboard" />
                  </div>
                  <fieldset>
                    <input
                      className=""
                      type="text"
                      placeholder="Search for answers..."
                      name="text"
                      required
                    />
                  </fieldset>
                  <div className="button-submit">
                    <button type="submit" onClick={(e) => e.preventDefault()}>
                      <i className="icon-search fs-20" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content pt-0">
        <Services />
        <Faqs />
      </div>
    </>
  );
}
