"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { title: "Home", href: "/" },
  { title: "Courses", href: "/courses" },
  { title: "Instructors", href: "/instructors" },
  { title: "About", href: "/about" },
  { title: "Contact Us", href: "/contact" },
];

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {NAV_ITEMS.map((item, i) => (
        <li key={i}>
          <Link
            href={item.href}
            className={isActive(item.href) ? "activeMenu" : ""}
          >
            {item.title}
          </Link>
        </li>
      ))}
    </>
  );
}
