import "dotenv/config";
import { db } from "../lib/db";
import { users, enrollments, reviews, courses } from "../lib/db/schema";
import { faker } from "@faker-js/faker";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";

const TARGET_COURSES = [
  "2f551d29-07b9-4fa9-9c7f-16842019da2c",
  "c5d01b74-44ef-4d43-a584-6204a7756c7a"
];

async function main() {
  console.log("🌱 Starting Mock Data Seeding...");

  // Verify the target courses exist
  const existingCourses = await db.select().from(courses).where(inArray(courses.id, TARGET_COURSES));
  if (existingCourses.length === 0) {
    console.error("❌ Target courses not found in the database. Please verify the IDs.");
    process.exit(1);
  }
  console.log(`✅ Found ${existingCourses.length} target courses.`);

  // 1. Generate Mock Students
  const NUM_STUDENTS = 20;
  console.log(`Generating ${NUM_STUDENTS} mock students...`);
  
  const newUsers = [];
  for (let i = 0; i < NUM_STUDENTS; i++) {
    newUsers.push({
      id: crypto.randomUUID(),
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      image: faker.image.avatar(),
      role: "STUDENT" as const,
      emailVerified: true,
    });
  }

  await db.insert(users).values(newUsers);
  console.log(`✅ Inserted ${newUsers.length} students.`);

  // 2. Enroll Students into Target Courses
  console.log("Enrolling students...");
  const newEnrollments = [];
  
  for (const student of newUsers) {
    // Enroll each student in 1 or both courses randomly
    const coursesToEnroll = faker.helpers.arrayElements(existingCourses, { min: 1, max: existingCourses.length });
    
    for (const course of coursesToEnroll) {
      newEnrollments.push({
        id: crypto.randomUUID(),
        userId: student.id,
        courseId: course.id,
        accessType: "PURCHASE" as const,
        createdAt: faker.date.recent({ days: 30 }),
      });
    }
  }

  await db.insert(enrollments).values(newEnrollments);
  console.log(`✅ Inserted ${newEnrollments.length} enrollments.`);

  // 3. Generate Realistic Reviews
  console.log("Generating realistic reviews...");
  const newReviews = [];
  
  const comments = [
    "Amazing course! Really helped me understand the concepts.",
    "Good material, but could be paced a bit better.",
    "Absolutely loved the practical examples. The instructor is very clear.",
    "Decent course, but some videos had low audio quality.",
    "I've learned so much from this. Highly recommended to beginners!",
    "Five stars all the way. Fantastic curriculum.",
    "It was okay. I already knew most of this stuff.",
    "The assignments were challenging and very rewarding.",
    "A bit too theoretical for my taste, I prefer more coding.",
    "Best course I've ever taken on this topic!",
    null, // Some reviews don't have comments
    null,
  ];

  for (const enrollment of newEnrollments) {
    // Only ~60% of students leave a review
    if (faker.number.int({ min: 1, max: 100 }) <= 60) {
      // Skew ratings towards positive (3-5)
      const rating = faker.helpers.weightedArrayElement([
        { weight: 1, value: 1 },
        { weight: 2, value: 2 },
        { weight: 5, value: 3 },
        { weight: 15, value: 4 },
        { weight: 25, value: 5 },
      ]);

      newReviews.push({
        id: crypto.randomUUID(),
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        rating: rating,
        comment: faker.helpers.arrayElement(comments),
        createdAt: faker.date.between({ from: enrollment.createdAt, to: new Date() }),
      });
    }
  }

  if (newReviews.length > 0) {
    await db.insert(reviews).values(newReviews);
    console.log(`✅ Inserted ${newReviews.length} reviews.`);
  }

  console.log("🎉 Seeding completed successfully!");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Seeding failed:");
  console.error(e);
  process.exit(1);
});
