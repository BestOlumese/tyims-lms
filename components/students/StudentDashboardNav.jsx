"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useEffect } from "react";
import { signOut } from "@/lib/auth/auth-client";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "flaticon-activity", label: "Dashboard" },
  { href: "/my-courses", icon: "flaticon-play-1", label: "My Courses" },
  { href: "/courses", icon: "flaticon-search", label: "Browse Courses" },
];

export default function StudentDashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const dropbtnRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    const btn = dropbtnRef.current;
    const nav = navRef.current;
    if (!btn || !nav) return;
    const toggle = () => {
      btn.classList.toggle("show");
      nav.classList.toggle("show");
    };
    const outside = (e) => {
      if (!btn.contains(e.target) && !nav.contains(e.target)) {
        btn.classList.remove("show");
        nav.classList.remove("show");
      }
    };
    btn.addEventListener("click", toggle);
    document.addEventListener("click", outside);
    return () => {
      btn.removeEventListener("click", toggle);
      document.removeEventListener("click", outside);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="col-xl-3 col-lg-12">
      <div className="dashboard_navigationbar">
        <div className="dropbtn" ref={dropbtnRef}>
          <i className="icon-home" /> Dashboard Navigation
        </div>
        <div className="instructors-dashboard" ref={navRef}>
          <div className="dashboard-title">
            STUDENT DASHBOARD
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                className={`dashboard-item${pathname === item.href ? " active" : ""}`}
                href={item.href}
              >
                <i className={item.icon} />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className="dashboard-item"
              onClick={handleLogout}
              style={{ background: "none", border: "none", width: "100%", cursor: "pointer" }}
            >
              <i className="flaticon-export" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
