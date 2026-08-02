"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

const NAV_ITEMS = [
  { title: "Home", href: "/" },
  { title: "Courses", href: "/courses" },
  { title: "Instructors", href: "/instructors" },
  { title: "About", href: "/about" },
  { title: "Contact Us", href: "/contact" },
];

// Only shown to visitors who could actually act on it — logged out or still a student.
// Instructors and admins already have teaching access, so it would be noise for them.
const TEACH_ITEM = { title: "Become an Instructor", href: "/become-instructor" };

export function shouldShowTeachLink(role) {
  return role !== "INSTRUCTOR" && role !== "ADMIN";
}

export default function Nav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const items = shouldShowTeachLink(session?.user?.role)
    ? [...NAV_ITEMS, TEACH_ITEM]
    : NAV_ITEMS;

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {items.map((item, i) => (
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
