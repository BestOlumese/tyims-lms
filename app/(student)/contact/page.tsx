import Brands from "@/upskill/components/common/Brands";
import ContactForm from "@/upskill/components/otherPages/contact/ContactForm";
import Features from "@/upskill/components/otherPages/contact/Features";
import Map from "@/upskill/components/otherPages/contact/Map";
import Link from "next/link";
import React from "react";

export const metadata = {
  title: "Contact Us | TYIMS LMS",
  description: "Get in touch with us",
};

export default function ContactPage() {
  return (
    <>
      <div className="page-title about">
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
                  <li>Contact Us</li>
                </ul>
                <h2 className="font-cardo fw-7">Contact Us</h2>
                <h6>
                  We'd love to hear from you. Get in touch with our team.
                </h6>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content pt-0">
        <div className="tf-spacing-24 pb-0">
          <Features />
          <ContactForm />
          <Brands />
          <Map />
        </div>
      </div>
    </>
  );
}
