"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth/auth-client";
import { dashboardLinks } from "@/lib/dashboard-links";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Courses", href: "/courses" },
  { label: "Instructors", href: "/instructors" },
  { label: "About", href: "/about" },
  { label: "Contact Us", href: "/contact" },
];

// Mirrors the desktop nav: hidden for users who already teach.
const TEACH_ITEM = { label: "Become an Instructor", href: "/become-instructor" };

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const { data: categoriesTree } = useQuery({
    ...orpc.getPublicCategories.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.querySelector("input")?.value?.trim();
    if (q) router.push(`/courses?q=${encodeURIComponent(q)}`);
    else router.push("/courses");
  };

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const user = session?.user;

  return (
    <>
      {/* Main mobile menu offcanvas */}
      <div
        className="offcanvas offcanvas-start mobile-menu"
        tabIndex={-1}
        id="offcanvasMenu"
        aria-labelledby="offcanvasMenuLabel"
      >
        <div className="offcanvas-header">
          <Link href="/" id="offcanvasMenuLabel" data-bs-dismiss="offcanvas">
            <Image
              src="/images/logo/logo.svg"
              alt="TYIMS LMS"
              width={120}
              height={36}
            />
          </Link>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />
        </div>

        <div className="offcanvas-body">
          <ul className="list-group">
            {(user?.role === "INSTRUCTOR" || user?.role === "ADMIN"
              ? NAV_ITEMS
              : [...NAV_ITEMS, TEACH_ITEM]
            ).map(({ href, label }) => (
              <li key={href} className="list-group-item">
                <Link
                  href={href}
                  data-bs-dismiss="offcanvas"
                  className={`nav-link-mobile${isActive(href) ? " activeMenu" : ""}`}
                >
                  {label}
                </Link>
              </li>
            ))}

            {/* Categories — outer collapse, per-category nested toggle */}
            {categoriesTree && categoriesTree.length > 0 && (
              <li className="list-group-item">
                <a
                  className="submenu-toggle collapsed"
                  data-bs-toggle="collapse"
                  href="#dropdown-categories"
                  aria-expanded="false"
                >
                  Categories
                </a>
                <div className="collapse" id="dropdown-categories">
                  <ul style={{ paddingLeft: 12, marginTop: 4 }}>
                    {categoriesTree.map((cat) => {
                      const hasSubs = cat.subItems && cat.subItems.length > 0;
                      const collapseId = `mobileCat-${cat.id}`;
                      return (
                        <li key={cat.id} style={{ marginBottom: 2 }}>
                          {hasSubs ? (
                            <>
                              <a
                                className="submenu-toggle collapsed nav-link-mobile"
                                data-bs-toggle="collapse"
                                href={`#${collapseId}`}
                                aria-expanded="false"
                                style={{ paddingTop: 6, paddingBottom: 6, display: "block" }}
                              >
                                {cat.name}
                              </a>
                              <div className="collapse" id={collapseId}>
                                <ul style={{ paddingLeft: 14, marginTop: 2, marginBottom: 4 }}>
                                  {cat.subItems.map((sub) => (
                                    <li key={sub.id} style={{ marginBottom: 2 }}>
                                      <Link
                                        href={`/category/${sub.slug || sub.id}`}
                                        data-bs-dismiss="offcanvas"
                                        className="nav-link-mobile"
                                        style={{ fontSize: 14, paddingTop: 4, paddingBottom: 4, display: "block", color: "#555" }}
                                      >
                                        {sub.name}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </>
                          ) : (
                            <Link
                              href={`/category/${cat.slug || cat.id}`}
                              data-bs-dismiss="offcanvas"
                              className="nav-link-mobile"
                              style={{ paddingTop: 6, paddingBottom: 6, display: "block" }}
                            >
                              {cat.name}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            )}
          </ul>

          {/* Dashboards — logged-in only.
              The mobile menu previously had no signed-in section at all, so there was no
              way to reach any dashboard from a phone. */}
          {user && (
            <div style={{ marginTop: 20, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#999",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {user.name || user.email}
              </p>
              <ul className="list-group">
                {dashboardLinks(user.role).map((link) => (
                  <li key={link.href} className="list-group-item">
                    <Link
                      href={link.href}
                      data-bs-dismiss="offcanvas"
                      className={`nav-link-mobile${isActive(link.href) ? " activeMenu" : ""}`}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <i className={link.icon} style={{ fontSize: 16, color: "#E27447" }} />
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li className="list-group-item">
                  <button
                    type="button"
                    data-bs-dismiss="offcanvas"
                    onClick={async () => {
                      await authClient.signOut();
                      router.push("/");
                      router.refresh();
                    }}
                    className="nav-link-mobile"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#e53e3e",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    <i className="flaticon-unlock" style={{ fontSize: 16 }} />
                    Sign Out
                  </button>
                </li>
              </ul>
            </div>
          )}

          {/* Auth buttons — logged-out only */}
          {!user && (
            <div className="header-btn flex gap-10" style={{ marginTop: 20 }}>
              <Link
                href="/login"
                data-bs-dismiss="offcanvas"
                className="tf-button-default header-text"
              >
                Log In
              </Link>
              <Link
                href="/register"
                data-bs-dismiss="offcanvas"
                className="tf-button-default active header-text"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Search offcanvas */}
      <div
        className="offcanvas offcanvas-start"
        tabIndex={-1}
        id="canvasSearch"
        aria-labelledby="canvasSearchLabel"
      >
        <div className="offcanvas-header">
          <h5 id="canvasSearchLabel" className="fw-5">Search</h5>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />
        </div>
        <div className="offcanvas-body">
          <form onSubmit={handleSearch} className="form-search">
            <fieldset>
              <input
                type="text"
                placeholder="Search for anything"
                tabIndex={2}
                aria-required="true"
              />
            </fieldset>
            <div className="button-submit">
              <button type="submit">
                <i className="icon-search fs-20" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
