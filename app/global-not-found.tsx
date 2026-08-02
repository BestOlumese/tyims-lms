import Footer1 from "@/upskill/components/footers/Footer1";
import Header1 from "@/upskill/components/headers/Header1";
import TemplateWrapper from "@/components/upskill/TemplateWrapper";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export const metadata = {
  title: "Page Not Found | TYIMS LMS",
  description: "The page you are looking for does not exist.",
};

export default function NotFoundPage() {
  return (
    <>
      <link rel="stylesheet" href="/css/bootstrap.css" />
      <link rel="stylesheet" href="/css/animate.min.css" />
      <link rel="stylesheet" href="/css/mmenu.css" />
      <link rel="stylesheet" href="/css/swiper-bundle.min.css" />
      <link rel="stylesheet" href="/css/magnific-popup.min.css" />
      <link rel="stylesheet" href="/css/template-main.css" />
      <link rel="stylesheet" href="/font/fonts.css" />
      <link rel="stylesheet" href="/icons/flat/flaticon_upskill.css" />
      <link rel="stylesheet" href="/icons/icomoon/style.css" />
      <TemplateWrapper>
        <div id="wrapper">
          <Header1 />
          <div className="main-content page-404">
            <section className="page-404-wrap">
              <div className="tf-container">
                <div className="row">
                  <div className="col-lg-8">
                    <div className="thumds">
                      <Image
                        className="ls-is-cached lazyloaded"
                        src="/images/section/404.png"
                        alt="404"
                        width={1536}
                        height={1236}
                      />
                    </div>
                  </div>
                  <div className="col-lg-4 flex items-center">
                    <div className="errors-404-content">
                      <h3>Oops! It looks like you&apos;re lost.</h3>
                      <p>
                        The page you&apos;re looking for isn&apos;t available. Try to search
                        again or use the go to.
                      </p>
                      <Link className="tf-btn" href={`/`}>
                        Go Back To Homepage <i className="icon-arrow-top-right" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <Footer1 />
        </div>
      </TemplateWrapper>
    </>
  );
}
