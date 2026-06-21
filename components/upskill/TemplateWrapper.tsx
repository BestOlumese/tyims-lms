"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { tabs } from "@/upskill/utlis/tabs";
import Context from "@/upskill/context/Context";
import SearchModal from "@/upskill/components/modals/SearchModal";
import MobileMenu from "@/upskill/components/modals/MobileMenu";
import BackToTop from "@/upskill/components/common/BackToTop";

// Initialise the tf-collapse accordion sections (sidebar filters, etc.)
function initTfCollapse() {
  document.querySelectorAll<HTMLElement>(".tf-collapse-item").forEach((item) => {
    const title = item.querySelector<HTMLElement>(".tf-collapse-title");
    const content = item.querySelector<HTMLElement>(".tf-collapse-content");
    if (!title || !content) return;

    // Set initial open state (not collapsed)
    if (!item.classList.contains("collapsed")) {
      content.style.maxHeight = content.scrollHeight + "px";
    } else {
      content.style.maxHeight = "0";
    }

    // Avoid double-binding
    if (title.dataset.collapseInit) return;
    title.dataset.collapseInit = "1";

    title.addEventListener("click", () => {
      const isCollapsed = item.classList.toggle("collapsed");
      content.style.maxHeight = isCollapsed ? "0" : content.scrollHeight + "px";
    });
  });
}

export default function TemplateWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastScrollY = useRef(0);
  const bootstrapRef = useRef<any>(null);

  // ── Bootstrap + WOW.js + tabs — run once on mount, then on every route change ──
  useEffect(() => {
    const initScripts = async () => {
      if (typeof window === "undefined") return;

      // Bootstrap — load once and cache on window
      if (!(window as any).__bootstrapLoaded) {
        const bootstrap = await import("bootstrap/dist/js/bootstrap.esm");
        (window as any).bootstrap = bootstrap;
        (window as any).__bootstrapLoaded = true;
        bootstrapRef.current = bootstrap;
      } else {
        bootstrapRef.current = (window as any).bootstrap;
      }

      // WOW.js — use live:true so dynamically rendered elements get animated
      const { WOW } = require("wowjs");
      const wow = new WOW({ mobile: false, live: true });
      wow.init();

      // Template tabs
      try { tabs(); } catch (_) {}

      // Accordion collapse sections
      initTfCollapse();
    };

    initScripts();
  }, [pathname]);

  // ── Re-run tf-collapse after React renders new content ──
  // Small delay ensures React has flushed DOM updates
  useEffect(() => {
    const id = setTimeout(initTfCollapse, 200);
    return () => clearTimeout(id);
  }, [pathname]);

  // ── Close modals/offcanvases on route change ──
  useEffect(() => {
    const bootstrap = (window as any)?.bootstrap;
    if (!bootstrap) return;

    document.querySelectorAll(".modal.show").forEach((el) => {
      bootstrap.Modal.getInstance(el)?.hide();
    });
    document.querySelectorAll(".offcanvas.show").forEach((el) => {
      bootstrap.Offcanvas.getInstance(el)?.hide();
    });
  }, [pathname]);

  // ── Sticky header scroll behaviour ──
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header");
    if (!header) return;

    const handleScroll = () => {
      const y = window.scrollY;
      if (y > 250) {
        header.style.top = y > lastScrollY.current ? "-100px" : "0px";
      } else {
        header.style.top = "0px";
      }
      lastScrollY.current = y;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return (
    <div className="counter-scroll">
      <Context>
        {children}
      </Context>
      <SearchModal />
      <BackToTop />
      <MobileMenu />
    </div>
  );
}
