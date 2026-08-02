"use client";
import React, { useState, useEffect, useRef } from "react";
import Nav from "./Nav";
import Link from "next/link";
import Image from "next/image";
import Categories from "./Categories";
import MobileNav from "./MobileNav";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { dashboardLinks } from "@/lib/dashboard-links";

export default function Header1() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchValue.trim();
    if (term) {
      router.push(`/courses?q=${encodeURIComponent(term)}`);
    } else {
      router.push("/courses");
    }
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const { itemCount } = useCart();

  const user = session?.user;
  const role = user?.role || "STUDENT";

  return (
    <header id="header_main" className="header">
      <div className="header-inner">
        <div className="header-inner-wrap">
          <div className="header-left flex-grow">
            <a
              className="mobile-nav-toggler mobile-button d-lg-none flex"
              type="button"
              data-bs-toggle="offcanvas"
              data-bs-target="#offcanvasMenu"
              aria-controls="offcanvasMenu"
            />
            <div id="site-logo">
              <Link href="/" rel="home">
                <Image
                  id="logo-header"
                  alt=""
                  src="/images/logo/logo.svg"
                  width={123}
                  height={36}
                />
              </Link>
            </div>
            <div className="header-catalog">
              <a href="#" className="header-text">
                Categories
                <i className="icon-arrow-bottom" />
              </a>
              <Categories />
            </div>
            <div className="header-search flex-grow">
              <form onSubmit={handleSearch} className="form-search">
                <fieldset>
                  <input
                    className=""
                    type="text"
                    placeholder="Search for anything"
                    name="text"
                    tabIndex={2}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    aria-required="true"
                  />
                </fieldset>
                <div className="button-submit">
                  <button className="" type="submit">
                    <i className="icon-search fs-20" />
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="header-right">
            <nav className="main-menu">
              <ul className="navigation">
                <Nav />
              </ul>
            </nav>
            {/* Mobile search icon */}
            <a
              className="d-lg-none flex"
              href="#canvasSearch"
              data-bs-toggle="offcanvas"
              aria-controls="canvasSearch"
            >
              <i className="icon-search fs-20" />
            </a>

            {/* Cart icon */}
            <Link
              href="/cart"
              className="header-cart flex items-center justify-center"
              style={{ position: "relative" }}
            >
              <i className="icon-shopcart fs-18" />
              {itemCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    background: "#E27447",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {itemCount}
                </span>
              )}
            </Link>

            <div className="header-btn flex gap-10">
              {!user && (
                <>
                  <div className="header-login">
                    <Link href="/login" className="tf-button-default header-text">
                      Log In
                    </Link>
                  </div>
                  <div className="header-register">
                    <Link
                      href="/register"
                      className="tf-button-default active header-text"
                    >
                      Sign Up
                    </Link>
                  </div>
                </>
              )}

              {user && (
                <div className="header-user" ref={userMenuRef} style={{ position: "relative" }}>
                  {/* Toggle button — shows on both desktop and mobile */}
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 0",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "2px solid #E27447",
                      }}
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || ""}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            background: "#E27447",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 15,
                          }}
                        >
                          {(user.name || user.email || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Name — hide on mobile */}
                    <span className="d-none d-lg-block" style={{ fontSize: 14, fontWeight: 600, color: "#131836" }}>
                      {user.name || user.email}
                    </span>
                    <i
                      className="d-none d-lg-block icon-arrow-bottom"
                      style={{
                        fontSize: 10,
                        transition: "transform 0.2s",
                        transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        minWidth: 200,
                        background: "#fff",
                        border: "1px solid #E4E4E7",
                        borderRadius: 12,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                        padding: 8,
                        zIndex: 999,
                      }}
                    >
                      {/* User info */}
                      <div style={{ padding: "8px 12px 12px", borderBottom: "1px solid #f0f0f0", marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#131836", whiteSpace: "nowrap" }}>
                          {user.name || user.email}
                        </div>
                        <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                          {role === "ADMIN" ? "Admin" : role === "INSTRUCTOR" ? "Instructor" : "Student"}
                        </div>
                      </div>
                      {/* Dashboards available to this role.
                          Staff also learn — an admin or instructor can buy courses, so they
                          keep access to the student area alongside their own dashboard. */}
                      {dashboardLinks(role).map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setUserMenuOpen(false)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "9px 12px",
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#131836",
                            textDecoration: "none",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f8f8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <i className={link.icon} style={{ fontSize: 16, color: "#E27447" }} />
                          {link.label}
                        </Link>
                      ))}
                      <div style={{ height: 1, background: "#f0f0f0", margin: "4px 0" }} />
                      {/* Sign out */}
                      <button
                        onClick={handleSignOut}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#e53e3e",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          width: "100%",
                          textAlign: "left",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#fff5f5")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <i className="flaticon-logout" style={{ fontSize: 16 }} />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <MobileNav />
    </header>
  );
}
