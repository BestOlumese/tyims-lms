"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import React, { useState } from "react";

const NAV_ITEMS = [
  { title: "Home", href: "/" },
  { title: "Courses", href: "/courses" },
  { title: "About", href: "/about" },
  { title: "Contact Us", href: "/contact" },
];

export default function MobileMenu() {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState(new Set());

  const { data: categoriesTree } = useQuery({
    ...orpc.getPublicCategories.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const rootCategories = categoriesTree || [];

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isOpen = (id) => openSections.has(id);

  const toggle = (id, e) => {
    e.preventDefault();
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="offcanvas offcanvas-start mobile-menu"
      tabIndex={-1}
      id="offcanvasMenu"
      aria-labelledby="offcanvasMenuLabel"
    >
      <div className="offcanvas-header">
        <h5 className="offcanvas-title" id="offcanvasMenuLabel">
          Menu
        </h5>
        <button
          type="button"
          className="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        />
      </div>

      <div className="offcanvas-body">
        <ul className="list-group">

          {/* Categories — React-controlled collapse so +/- icon is always correct */}
          {rootCategories.length > 0 && (
            <li className="list-group-item disabled-active-menu">
              <a
                href="#!"
                className={`submenu-toggle${isOpen("categories") ? "" : " collapsed"}`}
                onClick={(e) => toggle("categories", e)}
              >
                Categories
              </a>
              <ul className={`list-group collapse${isOpen("categories") ? " show" : ""}`}>
                {rootCategories.map((cat) => (
                  <li className="list-group-item" key={cat.id}>
                    {cat.subItems?.length > 0 ? (
                      <>
                        <a
                          href="#!"
                          className={`submenu-toggle${isOpen(cat.id) ? "" : " collapsed"}`}
                          onClick={(e) => toggle(cat.id, e)}
                        >
                          {cat.name}
                        </a>
                        <ul className={`list-group collapse${isOpen(cat.id) ? " show" : ""}`}>
                          {cat.subItems.map((sub) => (
                            <li className="list-group-item" key={sub.id}>
                              <Link
                                className="nav-link-mobile"
                                href={`/category/${sub.slug || sub.id}`}
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <Link
                        className="nav-link-mobile"
                        href={`/category/${cat.slug || cat.id}`}
                      >
                        {cat.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          )}

          {/* Main nav links */}
          {NAV_ITEMS.map((item) => (
            <li className="list-group-item" key={item.href}>
              <Link
                className={`nav-link-mobile${isActive(item.href) ? " activeMenu" : ""}`}
                href={item.href}
              >
                {item.title}
              </Link>
            </li>
          ))}

        </ul>
      </div>
    </div>
  );
}
