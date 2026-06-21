import TemplateWrapper from "@/components/upskill/TemplateWrapper";
import Header1 from "@/upskill/components/headers/Header1";
import Footer1 from "@/upskill/components/footers/Footer1";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          {children}
          <Footer1 />
        </div>
      </TemplateWrapper>
    </>
  );
}
