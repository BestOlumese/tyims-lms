import "dotenv/config";
import { db } from "../lib/db";
import { categories, users, courses, reviews, enrollments, chapters, lessons } from "../lib/db/schema";
import { faker } from "@faker-js/faker";
import crypto from "crypto";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed in production");
    process.exit(1);
  }

  console.log("🌱 Seeding full demo data...");

  // 1. Categories
  const cats = [];
  for (let i = 0; i < 8; i++) {
    const id = crypto.randomUUID();
    cats.push({ id, name: faker.word.words(2), slug: faker.helpers.slugify(faker.word.words(2)).toLowerCase(), parentId: null });
  }

  // Insert categories
  await db.insert(categories).values(cats as any);
  console.log(`✅ Inserted ${cats.length} categories.`);

  // 2. Subcategories
  const subs = [];
  for (const c of cats) {
    for (let j = 0; j < 8; j++) {
      subs.push({ id: crypto.randomUUID(), name: faker.word.words(2), slug: faker.helpers.slugify(faker.word.words(2)).toLowerCase(), parentId: c.id });
    }
  }
  await db.insert(categories).values(subs as any);
  console.log(`✅ Inserted ${subs.length} subcategories.`);

  // 3. Instructors
  const instructors = [];
  for (let i = 0; i < 8; i++) {
    const id = crypto.randomUUID();
    instructors.push({
      id,
      name: faker.person.fullName(),
      email: `instructor+${i}@example.com`,
      role: "INSTRUCTOR",
      image: `https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop&ixlib=rb-4.0.3&s=${i}`,
      aboutMe: faker.lorem.paragraph(),
      title: faker.person.jobTitle(),
      emailVerified: true,
    });
  }
  await db.insert(users).values(instructors as any);
  console.log(`✅ Inserted ${instructors.length} instructors.`);

  // 4. Courses
  const allCatIds = ([...(cats as any), ...(subs as any)] as any).map((c: any) => c.id);
  const newCourses = [];
  for (let i = 0; i < 200; i++) {
    const id = crypto.randomUUID();
    const title = faker.lorem.words({ min: 3, max: 7 });
    newCourses.push({
      id,
      title,
      slug: faker.helpers.slugify(title).toLowerCase(),
      description: faker.lorem.paragraph(),
      price: Number((Math.random() * 120).toFixed(2)),
      instructorId: faker.helpers.arrayElement(instructors).id,
      categoryId: faker.helpers.arrayElement(allCatIds),
      thumbnailUrl: `https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=800&auto=format&fit=crop&ixlib=rb-4.0.3&s=${i}`,
      bannerUrl: `https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.0.3&s=${i}`,
      whatYouWillLearn: [faker.lorem.words(5), faker.lorem.words(6), faker.lorem.words(4)],
      requirements: [faker.lorem.words(3), faker.lorem.words(2)],
      inclusions: ["Certificate of completion", "Lifetime access"],
      status: "PUBLISHED",
      createdAt: new Date(),
    });
  }
  await db.insert(courses).values(newCourses as any);
  console.log(`✅ Inserted ${newCourses.length} courses.`);

  // 6. Chapters and Lessons for each course
  const allChapters = [];
  const allLessons = [];
  for (const course of newCourses) {
    const chapterCount = faker.number.int({ min: 3, max: 6 });
    for (let ci = 0; ci < chapterCount; ci++) {
      const chapId = crypto.randomUUID();
      const chapTitle = `Chapter ${ci + 1}: ${faker.lorem.words(3)}`;
      allChapters.push({ id: chapId, courseId: course.id, title: chapTitle, description: faker.lorem.sentence(), orderIndex: ci + 1, isPublished: true, createdAt: new Date() });
      const lessonCount = faker.number.int({ min: 3, max: 7 });
      for (let li = 0; li < lessonCount; li++) {
        const lessonId = crypto.randomUUID();
        allLessons.push({ id: lessonId, chapterId: chapId, title: `Lesson ${li + 1}: ${faker.lorem.words(4)}`, description: faker.lorem.sentence(), type: 'VIDEO', orderIndex: li + 1, isFree: Math.random() < 0.2, isPublished: true, createdAt: new Date() });
      }
    }
  }

  if (allChapters.length) await db.insert(chapters).values(allChapters as any);
  if (allLessons.length) await db.insert(lessons).values(allLessons as any);
  console.log(`✅ Inserted ${allChapters.length} chapters and ${allLessons.length} lessons.`);

  // 5. Enrollments & Reviews (sample)
  const newEnrollments = [];
  const newReviews = [];
  for (const course of newCourses) {
    const enrollCount = faker.number.int({ min: 5, max: 30 });
    for (let i = 0; i < enrollCount; i++) {
      const studentId = crypto.randomUUID();
      // Create lightweight student user and only add enrollment if insert succeeds
      try {
        await db.insert(users).values({ id: studentId, name: faker.person.fullName(), email: faker.internet.email().toLowerCase(), role: "STUDENT", emailVerified: true });
        newEnrollments.push({ id: crypto.randomUUID(), userId: studentId, courseId: course.id, accessType: "PURCHASE", createdAt: faker.date.recent({ days: 90 }) });
        if (Math.random() < 0.6) {
          newReviews.push({ id: crypto.randomUUID(), userId: studentId, courseId: course.id, rating: faker.number.int({ min: 3, max: 5 }), comment: faker.lorem.sentence(), createdAt: new Date() });
        }
      } catch (err) {
        // If user insert fails (e.g. unique email), skip this enrollment
        continue;
      }
    }
  }

  if (newEnrollments.length) await db.insert(enrollments).values(newEnrollments as any);
  if (newReviews.length) await db.insert(reviews).values(newReviews as any);

  console.log(`✅ Inserted ${newEnrollments.length} enrollments and ${newReviews.length} reviews.`);

  console.log("🎉 Full seeding complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
