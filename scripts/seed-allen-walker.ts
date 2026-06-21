import "dotenv/config";
import { db } from "../lib/db";
import { users, courses, chapters, lessons, enrollments, reviews, categories } from "../lib/db/schema";
import { faker } from "@faker-js/faker";
import crypto from "crypto";
import { isNull, sql } from "drizzle-orm";

const COMMENTS = [
  "Absolutely incredible course. Allen explains everything so clearly — I finally understand closures!",
  "Best web dev course I've taken. The projects are real-world and the code quality is top-notch.",
  "Highly recommended for anyone starting out. The pacing is perfect and the content is up-to-date.",
  "Allen has a gift for breaking down complex topics. Finished the whole bootcamp in 3 weeks!",
  "Great content. Some sections could go deeper but overall very solid.",
  "I landed my first dev job after completing this course. Life-changing material.",
  "Clear, practical, and well-structured. No fluff — just the good stuff.",
  "Already knew some of this but the advanced sections were eye-opening. Worth every penny.",
  "The chapter on async/await finally made it click for me. Excellent explanation.",
  "Good course but some examples are a bit dated. Still very helpful overall.",
  null,
  null,
];

const COURSES_DATA = [
  {
    title: "Complete Web Development Bootcamp",
    description:
      "Master the full web development stack from scratch. This comprehensive bootcamp covers HTML5, CSS3, modern JavaScript (ES6+), React, Node.js, Express, and PostgreSQL. You'll build 12 real-world projects and finish ready to apply for your first developer role.",
    price: 45000,
    thumbnailUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
    whatYouWillLearn: [
      "Build fully responsive websites with HTML5 and CSS3",
      "Write modern JavaScript with ES6+ features",
      "Develop dynamic front-ends with React and React hooks",
      "Build RESTful APIs with Node.js and Express",
      "Store and query data with PostgreSQL and Drizzle ORM",
    ],
    requirements: [
      "A computer with internet access (Windows, Mac, or Linux)",
      "No prior programming experience required — we start from zero",
      "Willingness to practice and build projects alongside the videos",
    ],
    inclusions: [
      "48 hours of HD video content across 12 modules",
      "12 portfolio-ready projects with full source code",
      "Lifetime access and free future updates",
    ],
    chapters: [
      {
        title: "Getting Started with HTML & CSS",
        lessons: ["HTML Fundamentals", "CSS Styling & Box Model", "Flexbox & Grid Layouts", "Responsive Design & Media Queries"],
      },
      {
        title: "JavaScript Foundations",
        lessons: ["Variables, Types, and Operators", "Functions and Scope", "Arrays and Objects", "The DOM and Event Handling"],
      },
      {
        title: "Modern JavaScript (ES6+)",
        lessons: ["Arrow Functions & Template Literals", "Destructuring & Spread Operator", "Promises and Async/Await", "Modules and Imports"],
      },
      {
        title: "React — Building UIs",
        lessons: ["Component Basics and JSX", "Props, State, and Hooks", "React Router and Navigation", "Fetching Data with useEffect"],
      },
    ],
  },
  {
    title: "Advanced JavaScript: From ES6 to Mastery",
    description:
      "Take your JavaScript skills to the next level. This course dives deep into closures, prototypes, the event loop, design patterns, functional programming, and advanced async patterns. Essential for developers who want to understand JavaScript at the engine level.",
    price: 32000,
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
    whatYouWillLearn: [
      "Understand closures, scope chains, and the execution context",
      "Master the JavaScript prototype chain and class inheritance",
      "Write efficient asynchronous code with Promises, async/await, and generators",
      "Apply classic design patterns (factory, observer, singleton) in JS",
      "Optimise performance with memoisation, lazy loading, and Web Workers",
    ],
    requirements: [
      "Comfortable with basic JavaScript — variables, functions, arrays",
      "Familiarity with ES6 syntax (arrow functions, destructuring) is helpful",
      "Node.js installed on your machine",
    ],
    inclusions: [
      "32 hours of in-depth video lessons",
      "Coding challenges and exercises after every module",
      "Private community forum with direct instructor Q&A",
    ],
    chapters: [
      {
        title: "The JavaScript Engine & Execution Context",
        lessons: ["How the V8 Engine Works", "Call Stack and Memory Heap", "Closures in Depth", "The 'this' Keyword Demystified"],
      },
      {
        title: "Prototypes & Object-Oriented JS",
        lessons: ["Prototype Chain Explained", "ES6 Classes and Inheritance", "Mixins and Composition Patterns", "Private Fields and Methods"],
      },
      {
        title: "Asynchronous JavaScript Mastery",
        lessons: ["The Event Loop and Task Queue", "Promises Under the Hood", "Async/Await Best Practices", "Generators and Iterators"],
      },
      {
        title: "Design Patterns & Functional Programming",
        lessons: ["Factory and Singleton Patterns", "Observer and Pub/Sub", "Pure Functions and Immutability", "Currying and Function Composition"],
      },
    ],
  },
  {
    title: "React & Next.js: Build Production Apps",
    description:
      "Learn to build full-stack production applications with React 18 and Next.js 14 App Router. Covers server components, server actions, authentication, database integration, deployment to Vercel, and performance optimisation. The only React/Next.js course you'll ever need.",
    price: 38000,
    thumbnailUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80",
    whatYouWillLearn: [
      "Build fast, SEO-friendly apps with Next.js App Router and server components",
      "Implement authentication using NextAuth and Better Auth",
      "Integrate databases with Drizzle ORM and PostgreSQL",
      "Handle form submissions and mutations with server actions",
      "Deploy and optimise production apps on Vercel",
    ],
    requirements: [
      "Solid understanding of React basics (hooks, state, props)",
      "Basic knowledge of JavaScript and TypeScript",
      "Familiarity with databases and SQL is helpful but not required",
    ],
    inclusions: [
      "38 hours of project-based video content",
      "Complete source code for 3 production-grade apps",
      "Certificate of completion upon finishing the course",
    ],
    chapters: [
      {
        title: "Next.js App Router Fundamentals",
        lessons: ["File-Based Routing in Next.js 14", "Server vs Client Components", "Layouts, Loading, and Error Files", "Metadata and SEO Optimisation"],
      },
      {
        title: "Data Fetching & Server Actions",
        lessons: ["Fetching Data in Server Components", "Server Actions and Form Mutations", "Caching and Revalidation Strategies", "Optimistic UI Updates"],
      },
      {
        title: "Authentication & Database",
        lessons: ["Setting Up Better Auth", "Protected Routes and Middleware", "Drizzle ORM Schema Design", "Relations and Query Optimisation"],
      },
      {
        title: "Deployment & Performance",
        lessons: ["Deploying to Vercel", "Image Optimisation with next/image", "Core Web Vitals and Lighthouse Scores", "Monitoring with Vercel Analytics"],
      },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding Allen Walker instructor profile...\n");

  // 1. Get a category to attach courses to
  const [firstCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(isNull(categories.parentId))
    .limit(1);
  const categoryId = firstCategory?.id ?? null;
  console.log(categoryId ? `📂 Using category: ${categoryId}` : "📂 No category found — courses will have null categoryId");

  // 2. Insert Allen Walker
  const instructorId = crypto.randomUUID();
  await db
    .insert(users)
    .values({
      id: instructorId,
      name: "Allen Walker",
      email: "allen.walker@tyims.edu",
      role: "INSTRUCTOR",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
      title: "Senior Full Stack Developer & Web Educator",
      aboutMe: `<p>Allen Walker is a senior full stack developer with over 10 years of industry experience building scalable web applications for startups and Fortune 500 companies. He has worked with engineering teams at Google, Stripe, and several Y Combinator-backed startups across the US and Europe.</p>
<p>Allen specialises in the JavaScript ecosystem — React and Next.js on the frontend, Node.js and PostgreSQL on the backend. His teaching style focuses on real-world, production-quality code rather than toy examples. He has helped over 15,000 students launch successful developer careers through his online courses.</p>
<p>When not building or teaching, Allen mentors junior developers, contributes to open-source projects on GitHub, and speaks at developer conferences across Africa and Europe. He is a strong advocate for making high-quality tech education accessible to developers everywhere.</p>`,
      phone: "+1 (415) 234-7890",
      website: "https://allenwalker.dev",
      linkedinUrl: "https://linkedin.com/in/allenwalker",
      xUrl: "https://x.com/allenwalkerdev",
      facebookUrl: "https://facebook.com/allenwalkerdev",
      instagramUrl: "https://instagram.com/allenwalkerdev",
      emailVerified: true,
      instructorRequestStatus: "APPROVED",
      isBlocked: false,
      password: null,
    } as any)
    .onConflictDoNothing();
  console.log("✅ Allen Walker user created");

  // 3. Create courses, chapters, and lessons
  const courseIds: string[] = [];

  for (const courseData of COURSES_DATA) {
    const courseId = crypto.randomUUID();
    courseIds.push(courseId);

    await db.insert(courses).values({
      id: courseId,
      instructorId,
      categoryId,
      title: courseData.title,
      description: courseData.description,
      price: courseData.price,
      status: "PUBLISHED",
      thumbnailUrl: courseData.thumbnailUrl,
      whatYouWillLearn: courseData.whatYouWillLearn,
      requirements: courseData.requirements,
      inclusions: courseData.inclusions,
    } as any);

    for (let ci = 0; ci < courseData.chapters.length; ci++) {
      const chapterData = courseData.chapters[ci];
      const chapterId = crypto.randomUUID();

      await db.insert(chapters).values({
        id: chapterId,
        courseId,
        title: chapterData.title,
        orderIndex: ci + 1,
        isPublished: true,
      } as any);

      for (let li = 0; li < chapterData.lessons.length; li++) {
        await db.insert(lessons).values({
          id: crypto.randomUUID(),
          chapterId,
          title: chapterData.lessons[li],
          type: "VIDEO",
          orderIndex: li + 1,
          isFree: ci === 0 && li === 0,
          isPublished: true,
          durationSeconds: faker.number.int({ min: 300, max: 1800 }),
        } as any);
      }
    }

    console.log(`✅ Course created: "${courseData.title}"`);
  }

  // 4. Create 20 student users
  console.log("\n👥 Creating 20 students...");
  const studentIds: string[] = [];

  for (let i = 0; i < 20; i++) {
    const studentId = crypto.randomUUID();
    studentIds.push(studentId);
    await db.insert(users).values({
      id: studentId,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      role: "STUDENT",
      emailVerified: true,
      image: null,
      password: null,
    } as any).onConflictDoNothing();
  }
  console.log("✅ 20 students created");

  // 5. Enroll all students in all 3 courses
  console.log("\n📚 Enrolling students...");
  const enrollmentRecords: { id: string; userId: string; courseId: string; accessType: "PURCHASE"; createdAt: Date }[] = [];

  for (const studentId of studentIds) {
    for (const courseId of courseIds) {
      enrollmentRecords.push({
        id: crypto.randomUUID(),
        userId: studentId,
        courseId,
        accessType: "PURCHASE",
        createdAt: faker.date.recent({ days: 90 }),
      });
    }
  }

  await db.insert(enrollments).values(enrollmentRecords as any);
  console.log(`✅ ${enrollmentRecords.length} enrollments created (20 students × 3 courses)`);

  // 6. Generate reviews (~70% of enrollments)
  console.log("\n⭐ Generating reviews...");
  const reviewRecords: { id: string; userId: string; courseId: string; rating: number; comment: string | null; createdAt: Date }[] = [];

  for (const enrollment of enrollmentRecords) {
    if (faker.number.int({ min: 1, max: 100 }) <= 70) {
      const rating = faker.helpers.weightedArrayElement([
        { weight: 3, value: 1 },
        { weight: 7, value: 2 },
        { weight: 15, value: 3 },
        { weight: 35, value: 4 },
        { weight: 40, value: 5 },
      ]);
      reviewRecords.push({
        id: crypto.randomUUID(),
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        rating,
        comment: faker.helpers.arrayElement(COMMENTS),
        createdAt: faker.date.between({ from: enrollment.createdAt, to: new Date() }),
      });
    }
  }

  if (reviewRecords.length > 0) {
    await db.insert(reviews).values(reviewRecords as any);
  }
  console.log(`✅ ${reviewRecords.length} reviews generated`);

  console.log("\n🎉 Allen Walker fully seeded!");
  console.log(`   Instructor ID: ${instructorId}`);
  console.log(`   Courses: ${courseIds.length}`);
  console.log(`   Students: ${studentIds.length}`);
  console.log(`   Enrollments: ${enrollmentRecords.length}`);
  console.log(`   Reviews: ${reviewRecords.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
