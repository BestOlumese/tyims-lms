// Only routes that actually exist in this app.
// The template shipped links to /course-grid-basic, /instructor-list, /event-list,
// /become-teacher and /pricing, plus several "#" placeholders — all of which either
// 404'd or did nothing. They have been remapped to real routes or removed.
export const menuItems = [
  {
    title: "Company",
    delay: "0.2s",
    links: [
      { name: "About", href: "/about" },
      { name: "Courses", href: "/courses" },
      { name: "Instructors", href: "/instructors" },
      { name: "Become an Instructor", href: "/become-instructor" },
      { name: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Useful Links",
    delay: "0.3s",
    links: [
      { name: "Categories", href: "/categories" },
      { name: "FAQs", href: "/faq" },
      { name: "Help Center", href: "/help-center" },
      { name: "Terms", href: "/terms" },
      { name: "My Courses", href: "/my-courses" },
    ],
  },
  {
    title: "Popular Categories",
    delay: "0.4s",
    links: [
      { name: "Design", href: "/categories" },
      { name: "Development", href: "/categories" },
      { name: "Marketing", href: "/categories" },
      { name: "Personal Development", href: "/categories" },
      { name: "Business", href: "/categories" },
      { name: "IT and Software", href: "/categories" },
      { name: "Photography", href: "/categories" },
      { name: "Music", href: "/categories" },
    ],
  },
];

export const socialLinks = [
  { icon: "flaticon-facebook-1", href: "#" },
  { icon: "icon-twitter", href: "#" },
  { icon: "flaticon-instagram", href: "#" },
  { icon: "flaticon-linkedin-1", href: "#" },
];
