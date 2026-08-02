import "dotenv/config";
import { db } from "../lib/db";
import { users, enrollments, courses, chapters, lessons, quizzes, quizSubmissions, quizQuestions, quizOptions } from "../lib/db/schema";
import { faker } from "@faker-js/faker";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";

async function main() {
  console.log("🌱 Starting Assessments Seeding...");

  console.log("🧹 Clearing existing assessments data...");
  await db.delete(quizOptions);
  await db.delete(quizQuestions);
  await db.delete(quizSubmissions);
  await db.delete(quizzes);
  
  // Also delete any lessons that are purely quizzes we might have seeded, or clear quizId on existing lessons
  await db.update(lessons).set({ quizId: null });
  await db.delete(lessons).where(eq(lessons.type, "QUIZ"));

  console.log("✅ Cleared old assessments.");

  // 1. Fetch ALL Chapters
  const targetChapters = await db.select().from(chapters);

  if (targetChapters.length === 0) {
    console.error("❌ No chapters found in the database. Please ensure courses and chapters exist.");
    process.exit(1);
  }

  console.log(`✅ Found ${targetChapters.length} chapters. Generating dedicated quiz lessons...`);

  const newLessons = [];
  const newQuizzes = [];
  const generatedQuizIdsByCourse: Record<string, string[]> = {};
  const newQuestions = [];
  const newOptions = [];

  for (const chapter of targetChapters) {
    // 50% chance to add a quiz to a chapter, or maybe just 100% since user wants "more lesson quiz"
    if (faker.number.int({ min: 1, max: 100 }) <= 80) {
      const quizId = crypto.randomUUID();
      const lessonId = crypto.randomUUID();

      // Create a dedicated Quiz Lesson
      newLessons.push({
        id: lessonId,
        chapterId: chapter.id,
        title: `Chapter Assessment: ${faker.word.words(2)}`,
        type: "QUIZ" as const,
        orderIndex: 99, // Put it at the end of the chapter
        quizId: quizId,
        isPublished: true,
        isFree: false,
      });

      newQuizzes.push({
        id: quizId,
        courseId: chapter.courseId,
        title: `Quiz for ${chapter.title}`,
        description: "Test your knowledge on this chapter's topics.",
        passingScore: faker.helpers.arrayElement([70, 75, 80]),
        createdAt: faker.date.recent({ days: 30 }),
      });
      
      if (!generatedQuizIdsByCourse[chapter.courseId]) {
        generatedQuizIdsByCourse[chapter.courseId] = [];
      }
      generatedQuizIdsByCourse[chapter.courseId].push(quizId);

      // Generate 3 questions per quiz
      for (let i = 0; i < 3; i++) {
        const questionId = crypto.randomUUID();
        const isMultipleChoice = faker.datatype.boolean();

        newQuestions.push({
          id: questionId,
          quizId: quizId,
          question: faker.lorem.sentence() + "?",
          type: isMultipleChoice ? "MULTIPLE_CHOICE" : "TRUE_FALSE",
          orderIndex: i,
        });

        if (isMultipleChoice) {
          const correctOptionIndex = faker.number.int({ min: 0, max: 3 });
          for (let j = 0; j < 4; j++) {
            newOptions.push({
              id: crypto.randomUUID(),
              questionId: questionId,
              text: faker.lorem.words({ min: 2, max: 5 }),
              isCorrect: j === correctOptionIndex,
            });
          }
        } else {
          const isTrueCorrect = faker.datatype.boolean();
          newOptions.push({
            id: crypto.randomUUID(),
            questionId: questionId,
            text: "True",
            isCorrect: isTrueCorrect,
          });
          newOptions.push({
            id: crypto.randomUUID(),
            questionId: questionId,
            text: "False",
            isCorrect: !isTrueCorrect,
          });
        }
      }
    }
  }

  if (newQuizzes.length > 0) {
    await db.insert(quizzes).values(newQuizzes);
    console.log(`✅ Inserted ${newQuizzes.length} quizzes.`);

    // Insert new dedicated lessons AFTER quizzes to satisfy foreign key constraint
    await db.insert(lessons).values(newLessons);
    console.log(`✅ Inserted ${newLessons.length} new QUIZ lessons.`);
    
    if (newQuestions.length > 0) {
      await db.insert(quizQuestions).values(newQuestions);
      console.log(`✅ Inserted ${newQuestions.length} quiz questions.`);
    }

    if (newOptions.length > 0) {
      await db.insert(quizOptions).values(newOptions);
      console.log(`✅ Inserted ${newOptions.length} quiz options.`);
    }
  } else {
    console.log("No quizzes generated. Exiting.");
    process.exit(0);
  }

  // 3. Generate Student Attempts
  console.log("Generating student attempts for the new quizzes...");
  const newSubmissions = [];

  for (const courseId of Object.keys(generatedQuizIdsByCourse)) {
    const courseQuizzes = generatedQuizIdsByCourse[courseId];
    if (!courseQuizzes || courseQuizzes.length === 0) continue;

    // Get students enrolled in this course
    const courseEnrollments = await db
      .select({ userId: enrollments.userId, enrolledAt: enrollments.createdAt })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId));

    for (const enrollment of courseEnrollments) {
      // Each student attempts ~80% of the quizzes in the course
      for (const quizId of courseQuizzes) {
        if (faker.number.int({ min: 1, max: 100 }) <= 80) {
          const isPass = faker.number.int({ min: 1, max: 100 }) > 20;
          const score = isPass 
            ? faker.number.int({ min: 70, max: 100 })
            : faker.number.int({ min: 30, max: 69 });

          newSubmissions.push({
            id: crypto.randomUUID(),
            quizId: quizId,
            userId: enrollment.userId,
            score: score,
            isPassed: isPass,
            createdAt: faker.date.between({ from: enrollment.enrolledAt || new Date(), to: new Date() }),
          });
        }
      }
    }
  }

  if (newSubmissions.length > 0) {
    await db.insert(quizSubmissions).values(newSubmissions);
    console.log(`✅ Inserted ${newSubmissions.length} quiz attempts (submissions).`);
  }

  console.log("🎉 Assessments seeding completed successfully!");
  process.exit(0);
}



main().catch((e) => {
  console.error("❌ Seeding failed:");
  console.error(e);
  process.exit(1);
});
