export type DashboardLink = {
  href: string;
  label: string;
  /** Must exist in public/icons/flat/flaticon_upskill.css — an unknown class
   *  renders an invisible glyph instead of failing loudly. */
  icon: string;
};

const ADMIN_LINK: DashboardLink = {
  href: "/admin",
  label: "Admin Dashboard",
  icon: "flaticon-activity",
};

const INSTRUCTOR_LINK: DashboardLink = {
  href: "/instructor",
  label: "Instructor Dashboard",
  icon: "flaticon-graduation",
};

const STUDENT_LINK: DashboardLink = {
  href: "/dashboard",
  label: "My Learning",
  icon: "flaticon-online-training",
};

/**
 * Dashboards a role can reach, most-privileged first.
 *
 * Staff are learners too — an admin or instructor can buy and take courses — so they keep
 * the student area alongside their own dashboard.
 *
 * Every link here is genuinely reachable: proxy.ts admits ADMIN into /instructor, and
 * /dashboard is open to any signed-in user.
 *
 * Shared by the desktop header dropdown and the mobile menu. It lives here rather than in
 * Header1 because Header1 imports MobileNav, so importing back would be circular.
 */
export function dashboardLinks(role?: string | null): DashboardLink[] {
  if (role === "ADMIN") return [ADMIN_LINK, INSTRUCTOR_LINK, STUDENT_LINK];
  if (role === "INSTRUCTOR") return [INSTRUCTOR_LINK, STUDENT_LINK];
  return [STUDENT_LINK];
}
