// GLOBAL 404.
//
// With multiple root layouts there is no single layout Next can compose a 404 from, so
// this file provides one for the whole app (enabled via experimental.globalNotFound in
// next.config.ts). It bypasses normal rendering, so it must supply its own <html>, styles
// and fonts.
//
// Deliberately standalone: it does NOT render Header1/Footer1, which depend on the query
// client, session and cart providers. A 404 shouldn't need the whole provider tree.
import "./globals.css";
import "./template-theme.css";
import type { Metadata } from "next";
import { Cardo, DM_Sans } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const cardo = Cardo({
  variable: "--font-cardo",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Page Not Found | TYIMS LMS",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${dmSans.variable} ${cardo.variable}`}>
      <body>
        <div className="main-content page-404">
          <section className="page-404-wrap">
            <div className="tf-container">
              <div className="row">
                <div className="col-lg-8">
                  <div className="thumds">
                    <Image
                      src="/images/section/404.png"
                      alt=""
                      width={1536}
                      height={1236}
                      priority
                    />
                  </div>
                </div>
                <div className="col-lg-4 flex items-center">
                  <div className="errors-404-content">
                    <h3 className="font-cardo">Oops! It looks like you&apos;re lost.</h3>
                    <p>
                      The page you&apos;re looking for isn&apos;t available. Try searching
                      again or head back to the homepage.
                    </p>
                    <Link className="tf-btn" href="/">
                      Go Back To Homepage <i className="icon-arrow-top-right" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </body>
    </html>
  );
}
