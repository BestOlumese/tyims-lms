import TemplateWrapper from "@/components/upskill/TemplateWrapper";
import Header1 from "@/upskill/components/headers/Header1";
import Footer1 from "@/upskill/components/footers/Footer1";
import { CartProvider } from "@/lib/cart-context";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
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
      <CartProvider>
        <TemplateWrapper>
          <div id="wrapper">
            <div className="tf-top-bar flex items-center justify-center">
              <p>Intro price. Get UpSkill for Big Sale -95% off.</p>
            </div>
            <Header1 />
            {children}
            <Footer1 />
          </div>
        </TemplateWrapper>
      </CartProvider>
    </>
  );
}
