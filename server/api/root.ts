import { os, ORPCError } from "@orpc/server";
import { Context } from "./context";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  categories,
  users,
  courses,
  enrollments,
  chapters,
  lessons,
  quizzes,
  quizQuestions,
  quizOptions,
  quizSubmissions,
  quizSubmissionAnswers,
  attachments,
  reviews,
  transactions,
  videoProgress,
} from "@/lib/db/schema";
import { count, eq, sql, desc, asc, and, ilike, or, gt, inArray } from "drizzle-orm";
import { calcServiceFee, initializeTransaction, verifyTransaction } from "@/lib/paystack";
import { nanoid } from "nanoid";

// 1. Base Builder
const pub = os.$context<Context>();

// 2. Middlewares (The Gatekeepers)
const protectedProcedure = pub.use(({ context, next }) => {
  if (!context.user) throw new Error("UNAUTHORIZED");
  return next({ context: { user: context.user } });
});

const adminProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.user.role !== "ADMIN") throw new Error("FORBIDDEN: Admins only");
  return next({ context: { user: context.user } });
});

const instructorProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.user.role !== "INSTRUCTOR" && context.user.role !== "ADMIN") {
    throw new Error("FORBIDDEN: Instructors only");
  }
  return next({ context: { user: context.user } });
});

// 3. The Router Contracts
export const appRouter = pub.router({
  // Public: Fetch categories for navbar and public pages (nested)
  getPublicCategories: pub.handler(async () => {
    const rows = await db.select().from(categories).orderBy(categories.name);

    // Build a simple parent->children tree
    const map: Record<string, any> = {};
    rows.forEach((r: any) => {
      map[r.id] = { ...r, subItems: [] };
    });

    const roots: any[] = [];
    rows.forEach((r: any) => {
      const node = map[r.id];
      if (r.parentId) {
        const parent = map[r.parentId];
        if (parent) parent.subItems.push(node);
        else roots.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }),

  // Public: Fetch paginated courses for listing, with search & filters
  getPublicCourses: pub
    .input(
      z.object({
        page: z.number().min(1).optional().default(1),
        pageSize: z.number().min(1).max(100).optional().default(12),
        q: z.string().optional(),
        categoryIds: z.array(z.string()).optional(),
        priceFilter: z.enum(["free", "paid"]).optional(),
        sort: z.enum(["newest", "price_asc", "price_desc"]).optional().default("newest"),
      }),
    )
    .handler(async ({ input }) => {
      const page = input.page || 1;
      const pageSize = input.pageSize || 12;

      const whereClauses: any[] = [eq(courses.status, "PUBLISHED")];
      if (input.q) {
        const term = `%${input.q}%`;
        whereClauses.push(or(ilike(courses.title, term), ilike(courses.description, term)));
      }
      if (input.categoryIds && input.categoryIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        whereClauses.push(inArray(courses.categoryId as any, input.categoryIds));
      }
      if (input.priceFilter === "free") {
        whereClauses.push(eq(courses.price, 0));
      } else if (input.priceFilter === "paid") {
        whereClauses.push(gt(courses.price, 0));
      }

      const whereCondition = and(...whereClauses);

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(courses)
        .where(whereCondition);

      let orderBy: any = desc(courses.createdAt);
      if (input.sort === "price_asc") orderBy = asc(courses.price);
      if (input.sort === "price_desc") orderBy = desc(courses.price);

      const rows = await db
        .select({
          id: courses.id,
          title: courses.title,
          price: courses.price,
          discountPrice: courses.discountPrice,
          thumbnailUrl: courses.thumbnailUrl,
          instructorName: users.name,
          categoryName: categories.name,
          lessonCount: sql<number>`(SELECT count(*)::int FROM "lesson" l INNER JOIN "chapter" c ON l.chapter_id = c.id WHERE c.course_id = ${courses.id})`,
          totalDurationSeconds: sql<number>`coalesce((SELECT sum(l.duration_seconds)::int FROM "lesson" l INNER JOIN "chapter" c ON l.chapter_id = c.id WHERE c.course_id = ${courses.id}), 0)`,
          avgRating: sql<number>`coalesce((SELECT avg(rating)::float FROM "review" r WHERE r.course_id = ${courses.id}), 0)`,
          reviewCount: sql<number>`(SELECT count(*)::int FROM "review" r WHERE r.course_id = ${courses.id})`,
        })
        .from(courses)
        .leftJoin(users, eq(courses.instructorId, users.id))
        .leftJoin(categories, eq(courses.categoryId, categories.id))
        .where(whereCondition)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { total: total || 0, page, pageSize, data: rows };
    }),

  // Public: list instructors (with search, sort, pagination, and stats)
  getPublicInstructors: pub
    .input(z.object({
      page: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(12),
      q: z.string().optional(),
      sort: z.enum(["default", "name_asc", "name_desc", "rating_desc"]).optional().default("default"),
    }))
    .handler(async ({ input }) => {
      const page = input.page || 1;
      const pageSize = input.pageSize || 12;
      const whereClause = and(
        eq(users.role, "INSTRUCTOR"),
        input.q ? ilike(users.name, `%${input.q}%`) : undefined,
      );

      const [{ value: total }] = await db.select({ value: count() }).from(users).where(whereClause);

      const orderClause = input.sort === "name_asc" ? asc(users.name)
        : input.sort === "name_desc" ? desc(users.name)
        : asc(users.name);

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
          title: users.title,
          bio: users.aboutMe,
          courseCount: sql<number>`(SELECT count(*)::int FROM "course" c WHERE c.instructor_id = "user"."id" AND c.status = 'PUBLISHED')`,
          studentCount: sql<number>`(SELECT count(*)::int FROM "enrollment" e INNER JOIN "course" c ON e.course_id = c.id WHERE c.instructor_id = "user"."id")`,
          avgRating: sql<number>`coalesce((SELECT avg(r.rating)::float FROM "review" r INNER JOIN "course" c ON r.course_id = c.id WHERE c.instructor_id = "user"."id"), 0)`,
          reviewCount: sql<number>`(SELECT count(*)::int FROM "review" r INNER JOIN "course" c ON r.course_id = c.id WHERE c.instructor_id = "user"."id")`,
        })
        .from(users)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { total: total || 0, page, pageSize, data: rows };
    }),

  // Public: instructor detail with full stats and enriched courses
  getPublicInstructor: pub.input(z.object({ id: z.string() })).handler(async ({ input }) => {
    const [instructor] = await db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        title: users.title,
        bio: users.aboutMe,
        phone: users.phone,
        website: users.website,
        facebookUrl: users.facebookUrl,
        instagramUrl: users.instagramUrl,
        xUrl: users.xUrl,
        linkedinUrl: users.linkedinUrl,
        courseCount: sql<number>`(SELECT count(*)::int FROM "course" c WHERE c.instructor_id = ${input.id} AND c.status = 'PUBLISHED')`,
        studentCount: sql<number>`(SELECT count(*)::int FROM "enrollment" e INNER JOIN "course" c ON e.course_id = c.id WHERE c.instructor_id = ${input.id})`,
        avgRating: sql<number>`coalesce((SELECT avg(r.rating)::float FROM "review" r INNER JOIN "course" c ON r.course_id = c.id WHERE c.instructor_id = ${input.id}), 0)`,
        reviewCount: sql<number>`(SELECT count(*)::int FROM "review" r INNER JOIN "course" c ON r.course_id = c.id WHERE c.instructor_id = ${input.id})`,
      })
      .from(users)
      .where(eq(users.id, input.id));

    if (!instructor) return null;

    const instructorCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        price: courses.price,
        discountPrice: courses.discountPrice,
        thumbnailUrl: courses.thumbnailUrl,
        categoryName: categories.name,
        avgRating: sql<number>`coalesce((SELECT avg(r.rating)::float FROM "review" r WHERE r.course_id = ${courses.id}), 0)`,
        reviewCount: sql<number>`(SELECT count(*)::int FROM "review" r WHERE r.course_id = ${courses.id})`,
        enrollmentCount: sql<number>`(SELECT count(*)::int FROM "enrollment" e WHERE e.course_id = ${courses.id})`,
        lessonCount: sql<number>`(SELECT count(*)::int FROM "lesson" l INNER JOIN "chapter" c ON l.chapter_id = c.id WHERE c.course_id = ${courses.id})`,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(eq(courses.instructorId, input.id), eq(courses.status, "PUBLISHED")))
      .orderBy(desc(courses.createdAt))
      .limit(50);

    return { instructor, courses: instructorCourses };
  }),

  // Public: full course detail (curriculum + enrollment status)
  getPublicCourseDetail: pub.input(z.object({ id: z.string() })).handler(async ({ input, context }) => {
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        price: courses.price,
        discountPrice: courses.discountPrice,
        thumbnailUrl: courses.thumbnailUrl,
        whatYouWillLearn: courses.whatYouWillLearn,
        requirements: courses.requirements,
        inclusions: courses.inclusions,
        status: courses.status,
        instructorId: courses.instructorId,
        instructorName: users.name,
        instructorImage: users.image,
        instructorBio: users.aboutMe,
        instructorTitle: users.title,
        categoryName: categories.name,
        categorySlug: categories.slug,
        enrollmentCount: sql<number>`(SELECT count(*)::int FROM "enrollment" e WHERE e.course_id = ${courses.id})`,
        avgRating: sql<number>`coalesce((SELECT avg(rating)::float FROM "review" r WHERE r.course_id = ${courses.id}), 0)`,
        reviewCount: sql<number>`(SELECT count(*)::int FROM "review" r WHERE r.course_id = ${courses.id})`,
        lessonCount: sql<number>`(SELECT count(*)::int FROM "lesson" l INNER JOIN "chapter" c ON l.chapter_id = c.id WHERE c.course_id = ${courses.id})`,
        totalDurationSeconds: sql<number>`coalesce((SELECT sum(l.duration_seconds)::int FROM "lesson" l INNER JOIN "chapter" c ON l.chapter_id = c.id WHERE c.course_id = ${courses.id}), 0)`,
        createdAt: courses.createdAt,
        instructorStudentCount: sql<number>`(SELECT count(*)::int FROM "enrollment" e INNER JOIN "course" c2 ON e.course_id = c2.id WHERE c2.instructor_id = "course"."instructor_id")`,
        instructorCourseCount: sql<number>`(SELECT count(*)::int FROM "course" c2 WHERE c2.instructor_id = "course"."instructor_id")`,
        instructorAvgRating: sql<number>`coalesce((SELECT avg(r.rating)::float FROM "review" r INNER JOIN "course" c2 ON r.course_id = c2.id WHERE c2.instructor_id = "course"."instructor_id"), 0)`,
        instructorReviewCount: sql<number>`(SELECT count(*)::int FROM "review" r INNER JOIN "course" c2 ON r.course_id = c2.id WHERE c2.instructor_id = "course"."instructor_id")`,
      })
      .from(courses)
      .leftJoin(users, eq(courses.instructorId, users.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(eq(courses.id, input.id), eq(courses.status, "PUBLISHED")));

    if (!course) return null;

    const chaptersData = await db.query.chapters.findMany({
      where: eq(chapters.courseId, input.id),
      orderBy: asc(chapters.orderIndex),
      with: {
        lessons: {
          orderBy: asc(lessons.orderIndex),
          columns: {
            id: true,
            title: true,
            type: true,
            isFree: true,
            isPublished: true,
            durationSeconds: true,
            orderIndex: true,
            muxPlaybackId: true,
          },
        },
      },
      columns: {
        id: true,
        title: true,
        description: true,
        orderIndex: true,
        isPublished: true,
      },
    });

    let isEnrolled = false;
    if (context.user) {
      const [enrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(and(eq(enrollments.userId, context.user.id), eq(enrollments.courseId, input.id)));
      isEnrolled = !!enrollment;
    }

    return { ...course, chapters: chaptersData, isEnrolled };
  }),

  // Public: paginated course reviews
  getPublicCourseReviews: pub
    .input(
      z.object({
        courseId: z.string(),
        page: z.number().min(1).optional().default(1),
        pageSize: z.number().min(1).max(20).optional().default(5),
      }),
    )
    .handler(async ({ input }) => {
      const page = input.page || 1;
      const pageSize = input.pageSize || 5;

      const [{ value: total }] = await db
        .select({ value: count() })
        .from(reviews)
        .where(eq(reviews.courseId, input.courseId));

      const rows = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          userName: users.name,
          userImage: users.image,
        })
        .from(reviews)
        .leftJoin(users, eq(reviews.userId, users.id))
        .where(eq(reviews.courseId, input.courseId))
        .orderBy(desc(reviews.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { total: total || 0, page, pageSize, data: rows };
    }),

  // --- ADMIN DOMAIN ---
  admin: pub.router({
    // Create a Category (Required before instructors can make courses)
    createCategory: adminProcedure
      .input(
        z.object({
          name: z.string().min(2),
          slug: z.string().min(2),
          parentId: z.string().optional().nullable(),
        }),
      )
      .handler(async ({ input }) => {
        try {
          const [newCategory] = await db
            .insert(categories)
            .values({
              name: input.name,
              slug: input.slug,
              parentId: input.parentId,
            })
            .returning();

          return { success: true, category: newCategory };
        } catch (error: any) {
          if (error?.code === "23505") {
            // Unique constraint violation in Postgres
            throw new Error("A category with this slug already exists.");
          }
          throw error;
        }
      }),

    // Fetch all Categories (Available for instructors to categorize courses)
    getCategories: protectedProcedure.handler(async () => {
      return await db.select().from(categories);
    }),

    // Update a Category
    updateCategory: adminProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(2),
          slug: z.string().min(2),
          parentId: z.string().optional().nullable(),
        }),
      )
      .handler(async ({ input }) => {
        try {
          const [updatedCategory] = await db
            .update(categories)
            .set({
              name: input.name,
              slug: input.slug,
              parentId: input.parentId,
            })
            .where(eq(categories.id, input.id))
            .returning();

          return { success: true, category: updatedCategory };
        } catch (error: any) {
          if (error?.code === "23505") {
            throw new Error("A category with this slug already exists.");
          }
          throw error;
        }
      }),

    // Delete a Category
    deleteCategory: adminProcedure
      .input(
        z.object({
          id: z.string(),
        }),
      )
      .handler(async ({ input }) => {
        await db.delete(categories).where(eq(categories.id, input.id));
        return { success: true };
      }),

    // Platform Stats (For the Admin Dashboard Overview)
    getPlatformOverview: adminProcedure.handler(async () => {
      const [userCount] = await db.select({ value: count() }).from(users);
      const [courseCount] = await db.select({ value: count() }).from(courses);
      const [enrollmentCount] = await db
        .select({ value: count() })
        .from(enrollments);

      return {
        totalUsers: userCount?.value || 0,
        totalCourses: courseCount?.value || 0,
        totalEnrollments: enrollmentCount?.value || 0,
        totalRevenue: 0, // Placeholder until payments are integrated
      };
    }),

    // Fetch all Users
    getUsers: adminProcedure.handler(async () => {
      return await db.select().from(users).orderBy(desc(users.createdAt));
    }),

    // Toggle User Block Status
    toggleUserBlock: adminProcedure
      .input(
        z.object({
          userId: z.string(),
          isBlocked: z.boolean(),
        }),
      )
      .handler(async ({ input }) => {
        await db
          .update(users)
          .set({ isBlocked: input.isBlocked })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    // Get Pending & Rejected Instructor Requests
    getPendingInstructors: adminProcedure.handler(async () => {
      return await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.role, "STUDENT"),
            or(
              eq(users.instructorRequestStatus, "PENDING"),
              eq(users.instructorRequestStatus, "REJECTED"),
            ),
          ),
        )
        .orderBy(desc(users.updatedAt));
    }),

    // Handle Instructor Request (Approve/Deny)
    handleInstructorRequest: adminProcedure
      .input(
        z.object({
          userId: z.string(),
          action: z.enum(["APPROVE", "REJECT"]),
        }),
      )
      .handler(async ({ input }) => {
        if (input.action === "APPROVE") {
          await db
            .update(users)
            .set({
              role: "INSTRUCTOR",
              instructorRequestStatus: "APPROVED",
            })
            .where(eq(users.id, input.userId));
        } else {
          await db
            .update(users)
            .set({
              instructorRequestStatus: "REJECTED",
            })
            .where(eq(users.id, input.userId));
        }
        return { success: true };
      }),

    // --- COURSE MANAGEMENT ---
    getCourses: adminProcedure.handler(async () => {
      return await db
        .select({
          id: courses.id,
          title: courses.title,
          price: courses.price,
          status: courses.status,
          createdAt: courses.createdAt,
          instructorName: users.name,
          categoryName: categories.name,
        })
        .from(courses)
        .leftJoin(users, eq(courses.instructorId, users.id))
        .leftJoin(categories, eq(courses.categoryId, categories.id))
        .orderBy(desc(courses.createdAt));
    }),

    deleteCourse: adminProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input }) => {
        await db.delete(courses).where(eq(courses.id, input.id));
        return { success: true };
      }),

    // Change User Role (Promote/Downgrade)
    changeUserRole: adminProcedure
      .input(
        z.object({
          userId: z.string(),
          role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
        }),
      )
      .handler(async ({ input }) => {
        await db
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    // Update Profile (Name)
    updateProfile: adminProcedure
      .input(
        z.object({
          name: z.string().min(2),
        }),
      )
      .handler(async ({ input, context }) => {
        await db
          .update(users)
          .set({ name: input.name })
          .where(eq(users.id, context.user.id));
        return { success: true };
      }),
  }),

  // --- INSTRUCTOR DOMAIN ---
  instructor: pub.router({
    // Instructor Overview Stats
    getOverview: instructorProcedure.handler(async ({ context }) => {
      const instructorId = context.user.id;

      // 1. Total Courses
      const [courseStats] = await db
        .select({ value: count() })
        .from(courses)
        .where(eq(courses.instructorId, instructorId));

      // 2. Total Students & Revenue
      const instructorCourses = await db
        .select({ id: courses.id, price: courses.price })
        .from(courses)
        .where(eq(courses.instructorId, instructorId));

      const courseIds = instructorCourses.map((c) => c.id);

      let totalStudents = 0;
      let totalRevenue = 0;

      if (courseIds.length > 0) {
        const allEnrollments = await db
          .select({ courseId: enrollments.courseId })
          .from(enrollments)
          .where(sql`${enrollments.courseId} IN ${courseIds}`);

        totalStudents = allEnrollments.length;

        // Calculate revenue based on enrollments and course prices
        allEnrollments.forEach((en) => {
          const course = instructorCourses.find((c) => c.id === en.courseId);
          if (course) totalRevenue += course.price;
        });
      }

      return {
        totalCourses: courseStats?.value || 0,
        totalStudents,
        totalRevenue,
        recentEnrollments: [], // TODO: Implement if needed
      };
    }),

    // Get Instructor's Courses
    getMyCourses: instructorProcedure.handler(async ({ context }) => {
      return await db
        .select()
        .from(courses)
        .where(eq(courses.instructorId, context.user.id))
        .orderBy(desc(courses.createdAt));
    }),

    // Create a Course
    createCourse: instructorProcedure
      .input(z.object({ title: z.string().min(3) }))
      .handler(async ({ input, context }) => {
        const [newCourse] = await db
          .insert(courses)
          .values({
            title: input.title,
            instructorId: context.user.id,
          })
          .returning();
        return newCourse;
      }),

    // Get Course Details for Editing
    getCourse: instructorProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        const [course] = await db
          .select()
          .from(courses)
          .where(
            and(
              eq(courses.id, input.id),
              eq(courses.instructorId, context.user.id),
            ),
          );
        if (!course) throw new Error("Course not found");
        return course;
      }),

    // Update Course
    updateCourse: instructorProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(3).optional(),
          description: z.string().optional(),
          price: z.number().min(0).optional(),
          discountPrice: z.number().min(0).optional().nullable(),
          categoryId: z.string().optional().nullable(),
          status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
          thumbnailUrl: z.string().optional().nullable(),
          whatYouWillLearn: z.array(z.string()).optional(),
          requirements: z.array(z.string()).optional(),
          inclusions: z.array(z.string()).optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        const [updatedCourse] = await db
          .update(courses)
          .set(input)
          .where(
            and(
              eq(courses.id, input.id),
              eq(courses.instructorId, context.user.id),
            ),
          )
          .returning();
        return updatedCourse;
      }),

    // --- CHAPTERS MANAGEMENT ---
    getChapters: instructorProcedure
      .input(z.object({ courseId: z.string() }))
      .handler(async ({ input }) => {
        return await db.query.chapters.findMany({
          where: eq(chapters.courseId, input.courseId),
          orderBy: (chapters, { asc }) => [asc(chapters.orderIndex)],
          with: {
            lessons: {
              orderBy: (lessons, { asc }) => [asc(lessons.orderIndex)],
            },
          },
        });
      }),

    createChapter: instructorProcedure
      .input(z.object({ courseId: z.string(), title: z.string() }))
      .handler(async ({ input }) => {
        const lastChapter = await db
          .select({ orderIndex: chapters.orderIndex })
          .from(chapters)
          .where(eq(chapters.courseId, input.courseId))
          .orderBy(desc(chapters.orderIndex))
          .limit(1)
          .then((res) => res[0]);

        const newOrderIndex = (lastChapter?.orderIndex ?? -1) + 1;

        const [newChapter] = await db
          .insert(chapters)
          .values({
            courseId: input.courseId,
            title: input.title,
            orderIndex: newOrderIndex,
          })
          .returning();
        return newChapter;
      }),

    updateChapter: instructorProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          isPublished: z.boolean().optional(),
        }),
      )
      .handler(async ({ input }) => {
        const [updatedChapter] = await db
          .update(chapters)
          .set(input)
          .where(eq(chapters.id, input.id))
          .returning();
        return updatedChapter;
      }),

    deleteChapter: instructorProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input }) => {
        try {
          await db.delete(chapters).where(eq(chapters.id, input.id));
          return { success: true };
        } catch (error) {
          console.error("DELETE_CHAPTER_ERROR", error);
          throw error;
        }
      }),

    reorderChapters: instructorProcedure
      .input(z.array(z.object({ id: z.string(), position: z.number() })))
      .handler(async ({ input }) => {
        for (const item of input) {
          await db
            .update(chapters)
            .set({ orderIndex: item.position })
            .where(eq(chapters.id, item.id));
        }
        return { success: true };
      }),

    // --- CURRICULUM ITEMS (LESSONS) MANAGEMENT ---
    getLessons: instructorProcedure
      .input(z.object({ chapterId: z.string() }))
      .handler(async ({ input }) => {
        return await db
          .select()
          .from(lessons)
          .where(eq(lessons.chapterId, input.chapterId))
          .orderBy(lessons.orderIndex);
      }),

    createLesson: instructorProcedure
      .input(
        z.object({
          chapterId: z.string(),
          title: z.string(),
          type: z.enum(["VIDEO", "QUIZ", "FILE"]).optional(),
        }),
      )
      .handler(async ({ input }) => {
        const chapter = await db
          .select({ courseId: chapters.courseId })
          .from(chapters)
          .where(eq(chapters.id, input.chapterId))
          .then((res) => res[0]);

        if (!chapter) throw new Error("Chapter not found");

        const lastLesson = await db
          .select({ orderIndex: lessons.orderIndex })
          .from(lessons)
          .where(eq(lessons.chapterId, input.chapterId))
          .orderBy(desc(lessons.orderIndex))
          .limit(1)
          .then((res) => res[0]);

        const newOrderIndex = (lastLesson?.orderIndex ?? -1) + 1;

        let quizId = null;
        if (input.type === "QUIZ") {
          const [newQuiz] = await db
            .insert(quizzes)
            .values({
              courseId: chapter.courseId,
              title: input.title,
            })
            .returning();
          quizId = newQuiz.id;
        }

        const [newLesson] = await db
          .insert(lessons)
          .values({
            chapterId: input.chapterId,
            title: input.title,
            type: input.type || "VIDEO",
            orderIndex: newOrderIndex,
            quizId: quizId,
          })
          .returning();
        return newLesson;
      }),

    updateLesson: instructorProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          isPublished: z.boolean().optional(),
          isFree: z.boolean().optional(),
          muxUploadId: z.string().optional().nullable(),
          muxAssetId: z.string().optional().nullable(),
          muxPlaybackId: z.string().optional().nullable(),
          fileUrl: z.string().optional().nullable(),
          fileName: z.string().optional().nullable(),
          fileSize: z.number().optional().nullable(),
          quizId: z.string().optional().nullable(),
        }),
      )
      .handler(async ({ input }) => {
        const [updatedLesson] = await db
          .update(lessons)
          .set(input)
          .where(eq(lessons.id, input.id))
          .returning();
        return updatedLesson;
      }),

    deleteLesson: instructorProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input }) => {
        try {
          await db.delete(lessons).where(eq(lessons.id, input.id));
          return { success: true };
        } catch (error) {
          console.error("DELETE_LESSON_ERROR", error);
          throw error;
        }
      }),

    reorderLessons: instructorProcedure
      .input(z.array(z.object({ id: z.string(), position: z.number() })))
      .handler(async ({ input }) => {
        for (const item of input) {
          await db
            .update(lessons)
            .set({ orderIndex: item.position })
            .where(eq(lessons.id, item.id));
        }
        return { success: true };
      }),

    // --- QUIZ MANAGEMENT ---
    getQuizzes: instructorProcedure
      .input(z.object({ courseId: z.string() }))
      .handler(async ({ input }) => {
        return await db
          .select()
          .from(quizzes)
          .where(eq(quizzes.courseId, input.courseId));
      }),

    createQuiz: instructorProcedure
      .input(z.object({ courseId: z.string(), title: z.string() }))
      .handler(async ({ input }) => {
        const [newQuiz] = await db.insert(quizzes).values(input).returning();
        return newQuiz;
      }),

    updateQuiz: instructorProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          passingScore: z.number().optional(),
        }),
      )
      .handler(async ({ input }) => {
        const [updatedQuiz] = await db
          .update(quizzes)
          .set(input)
          .where(eq(quizzes.id, input.id))
          .returning();
        return updatedQuiz;
      }),

    deleteQuiz: instructorProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input }) => {
        await db.delete(quizzes).where(eq(quizzes.id, input.id));
        return { success: true };
      }),

    // --- QUIZ QUESTIONS MANAGEMENT ---
    getQuestions: instructorProcedure
      .input(z.object({ quizId: z.string() }))
      .handler(async ({ input }) => {
        console.log(`[GET_QUESTIONS] QuizID: ${input.quizId}`);
        const questions = await db
          .select()
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, input.quizId))
          .orderBy(quizQuestions.orderIndex);
        
        console.log(`[GET_QUESTIONS] Found ${questions.length} questions`);

        const questionsWithOptions = await Promise.all(
          questions.map(async (q) => {
            const options = await db
              .select()
              .from(quizOptions)
              .where(eq(quizOptions.questionId, q.id));
            return { ...q, options };
          }),
        );

        return questionsWithOptions;
      }),

    createQuestion: instructorProcedure
      .input(
        z.object({
          quizId: z.string(),
          question: z.string(),
          type: z.string().optional(),
        }),
      )
      .handler(async ({ input }) => {
        const lastQ = await db
          .select({ orderIndex: quizQuestions.orderIndex })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, input.quizId))
          .orderBy(desc(quizQuestions.orderIndex))
          .limit(1)
          .then((res) => res[0]);

        const [newQ] = await db
          .insert(quizQuestions)
          .values({
            ...input,
            orderIndex: (lastQ?.orderIndex ?? -1) + 1,
          })
          .returning();
        return newQ;
      }),

    updateQuestion: instructorProcedure
      .input(
        z.object({
          id: z.string(),
          question: z.string().optional(),
          type: z.string().optional(),
        }),
      )
      .handler(async ({ input }) => {
        const [updatedQ] = await db
          .update(quizQuestions)
          .set(input)
          .where(eq(quizQuestions.id, input.id))
          .returning();
        return updatedQ;
      }),

    deleteQuestion: instructorProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input }) => {
        await db.delete(quizQuestions).where(eq(quizQuestions.id, input.id));
        return { success: true };
      }),

    // --- QUIZ OPTIONS MANAGEMENT ---
    upsertOption: instructorProcedure
      .input(
        z.object({
          id: z.string().optional(),
          questionId: z.string(),
          text: z.string(),
          isCorrect: z.boolean(),
        }),
      )
      .handler(async ({ input }) => {
        if (input.id) {
          const [updated] = await db
            .update(quizOptions)
            .set(input)
            .where(eq(quizOptions.id, input.id))
            .returning();
          return updated;
        } else {
          const [newOption] = await db
            .insert(quizOptions)
            .values({
              questionId: input.questionId,
              text: input.text,
              isCorrect: input.isCorrect,
            })
            .returning();
          return newOption;
        }
      }),

    deleteOption: instructorProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input }) => {
        await db.delete(quizOptions).where(eq(quizOptions.id, input.id));
        return { success: true };
      }),

    // --- REVIEW MANAGEMENT ---
    getInstructorCoursesWithReviewStats: instructorProcedure
      .handler(async ({ context }) => {
        const result = await db
          .select({
            id: courses.id,
            title: courses.title,
            reviewCount: sql<number>`count(${reviews.id})::int`,
            averageRating: sql<number>`avg(${reviews.rating})::float`,
          })
          .from(courses)
          .leftJoin(reviews, eq(courses.id, reviews.courseId))
          .where(eq(courses.instructorId, context.user.id))
          .groupBy(courses.id)
          .orderBy(desc(courses.createdAt));
        
        return result.map(c => ({
          ...c,
          averageRating: c.averageRating || 0
        }));
      }),

    getInstructorStudents: instructorProcedure
      .handler(async ({ context }) => {
        return await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            enrollmentCount: sql<number>`count(distinct ${enrollments.courseId})::int`,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .innerJoin(users, eq(enrollments.userId, users.id))
          .where(eq(courses.instructorId, context.user.id))
          .groupBy(users.id, users.name, users.email, users.image)
          .orderBy(users.name);
      }),

    getStudentDetails: instructorProcedure
      .input(z.object({ studentId: z.string() }))
      .handler(async ({ input, context }) => {
        const enrolledCourses = await db
          .select({
            id: courses.id,
            title: courses.title,
            enrolledAt: enrollments.createdAt,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .where(and(
            eq(enrollments.userId, input.studentId),
            eq(courses.instructorId, context.user.id)
          ))
          .orderBy(desc(enrollments.createdAt));

        const studentReviews = await db
          .select({
            id: reviews.id,
            courseId: courses.id,
            courseTitle: courses.title,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
          })
          .from(reviews)
          .innerJoin(courses, eq(reviews.courseId, courses.id))
          .where(and(
            eq(reviews.userId, input.studentId),
            eq(courses.instructorId, context.user.id)
          ))
          .orderBy(desc(reviews.createdAt));

        return { enrolledCourses, studentReviews };
      }),

    getCourseReviews: instructorProcedure
      .input(z.object({ courseId: z.string() }))
      .handler(async ({ input }) => {
        return await db
          .select({
            id: reviews.id,
            rating: reviews.rating,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            userName: users.name,
            userImage: users.image,
          })
          .from(reviews)
          .leftJoin(users, eq(reviews.userId, users.id))
          .where(eq(reviews.courseId, input.courseId))
          .orderBy(desc(reviews.createdAt));
      }),

    // Bulk Save Quiz (Questions & Options)
    saveQuiz: instructorProcedure
      .input(
        z.object({
          quizId: z.string(),
          questions: z.array(
            z.object({
              id: z.string().optional(),
              question: z.string(),
              type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]),
              orderIndex: z.number(),
              options: z.array(
                z.object({
                  id: z.string().optional(),
                  text: z.string(),
                  isCorrect: z.boolean(),
                })
              ),
            })
          ),
        })
      )
      .handler(async ({ input }) => {
        const { quizId, questions: inputQuestions } = input;
        console.log(`[SAVE_QUIZ] QuizID: ${quizId}, Questions: ${inputQuestions.length}`);

        // Use a transaction for atomic save
        await db.transaction(async (tx) => {
          // 1. Delete all existing questions for this quiz
          await tx.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));

          // 2. Insert questions and their options
          for (const q of inputQuestions) {
            const [insertedQ] = await tx
              .insert(quizQuestions)
              .values({
                quizId,
                question: q.question,
                type: q.type,
                orderIndex: q.orderIndex,
              })
              .returning();

            if (q.options.length > 0) {
              await tx.insert(quizOptions).values(
                q.options.map((opt) => ({
                  questionId: insertedQ.id,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                }))
              );
            }
          }
        });

        return { success: true };
      }),

    // --- ASSESSMENTS MANAGEMENT ---
    getInstructorAssessmentsStats: instructorProcedure
      .handler(async ({ context }) => {
        // Find courses belonging to this instructor with at least one quiz
        const result = await db
          .select({
            id: courses.id,
            title: courses.title,
            quizCount: sql<number>`count(distinct ${quizzes.id})::int`,
            submissionsCount: sql<number>`count(distinct ${quizSubmissions.id})::int`,
          })
          .from(courses)
          .leftJoin(quizzes, eq(courses.id, quizzes.courseId))
          .leftJoin(quizSubmissions, eq(quizzes.id, quizSubmissions.quizId))
          .where(eq(courses.instructorId, context.user.id))
          .groupBy(courses.id)
          .orderBy(desc(courses.createdAt));
        
        return result.filter(c => c.quizCount > 0);
      }),

    getCourseQuizzes: instructorProcedure
      .input(z.object({ courseId: z.string() }))
      .handler(async ({ input, context }) => {
        // Ensure course belongs to instructor
        const [course] = await db.select().from(courses).where(and(eq(courses.id, input.courseId), eq(courses.instructorId, context.user.id)));
        if (!course) throw new Error("Unauthorized or course not found");

        const courseQuizzes = await db
          .select({
            id: quizzes.id,
            title: lessons.title, // Quiz takes title from lesson
            chapterTitle: chapters.title,
            lessonId: lessons.id,
            passingScore: quizzes.passingScore,
            submissionsCount: sql<number>`count(distinct ${quizSubmissions.id})::int`,
          })
          .from(chapters)
          .innerJoin(lessons, eq(chapters.id, lessons.chapterId))
          .innerJoin(quizzes, eq(quizzes.id, lessons.quizId))
          .leftJoin(quizSubmissions, eq(quizzes.id, quizSubmissions.quizId))
          .where(eq(chapters.courseId, input.courseId))
          .groupBy(quizzes.id, lessons.id, chapters.title, lessons.title, quizzes.passingScore, chapters.orderIndex, lessons.orderIndex)
          .orderBy(chapters.orderIndex, lessons.orderIndex);

        return courseQuizzes;
      }),

    getQuizAttempts: instructorProcedure
      .input(z.object({ quizId: z.string() }))
      .handler(async ({ input, context }) => {
        // Ensure quiz belongs to a course owned by this instructor
        const [quizAuth] = await db
          .select({ id: quizzes.id, passingScore: quizzes.passingScore })
          .from(quizzes)
          .innerJoin(courses, eq(quizzes.courseId, courses.id))
          .where(and(eq(quizzes.id, input.quizId), eq(courses.instructorId, context.user.id)));

        if (!quizAuth) throw new Error("Unauthorized or quiz not found");

        const attempts = await db
          .select({
            id: quizSubmissions.id,
            studentId: users.id,
            studentName: users.name,
            studentImage: users.image,
            score: quizSubmissions.score,
            submittedAt: quizSubmissions.createdAt,
          })
          .from(quizSubmissions)
          .innerJoin(users, eq(quizSubmissions.userId, users.id))
          .where(eq(quizSubmissions.quizId, input.quizId))
          .orderBy(desc(quizSubmissions.createdAt));

        return {
          attempts: attempts.map(a => ({
            ...a,
            passed: quizAuth.passingScore !== null ? a.score >= quizAuth.passingScore : null,
          })),
          passingScore: quizAuth.passingScore
        };
      }),

    // --- SETTINGS ---
    updateInstructorProfile: instructorProcedure
      .input(
        z.object({
          name: z.string().min(1),
          title: z.string().optional().nullable(),
          aboutMe: z.string().optional().nullable(),
          phone: z.string().optional().nullable(),
          website: z.string().optional().nullable(),
          facebookUrl: z.string().optional().nullable(),
          instagramUrl: z.string().optional().nullable(),
          xUrl: z.string().optional().nullable(),
          linkedinUrl: z.string().optional().nullable(),
          image: z.string().optional().nullable(),
        })
      )
      .handler(async ({ input, context }) => {
        await db
          .update(users)
          .set({
            name: input.name,
            title: input.title,
            aboutMe: input.aboutMe,
            phone: input.phone,
            website: input.website,
            facebookUrl: input.facebookUrl,
            instagramUrl: input.instagramUrl,
            xUrl: input.xUrl,
            linkedinUrl: input.linkedinUrl,
            image: input.image,
            updatedAt: new Date(),
          })
          .where(eq(users.id, context.user.id));
          
        return { success: true };
      }),
  }),

  // --- STUDENT DOMAIN ---
  student: pub.router({
    getProfile: protectedProcedure.handler(({ context }) => {
      return { id: context.user.id, role: context.user.role };
    }),

    getEnrolledCourses: protectedProcedure.handler(async ({ context }) => {
      const userId = context.user.id;
      const rows = await db
        .select({
          courseId: courses.id,
          title: courses.title,
          thumbnailUrl: courses.thumbnailUrl,
          price: courses.price,
          discountPrice: courses.discountPrice,
          instructorName: users.name,
          enrolledAt: enrollments.createdAt,
          accessType: enrollments.accessType,
          lessonCount: sql<number>`(SELECT count(*)::int FROM "lesson" l INNER JOIN "chapter" c ON l.chapter_id = c.id WHERE c.course_id = ${courses.id})`,
          avgRating: sql<number>`coalesce((SELECT avg(rating)::float FROM "review" r WHERE r.course_id = ${courses.id}), 0)`,
          reviewCount: sql<number>`(SELECT count(*)::int FROM "review" r WHERE r.course_id = ${courses.id})`,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .leftJoin(users, eq(courses.instructorId, users.id))
        .where(eq(enrollments.userId, userId))
        .orderBy(desc(enrollments.createdAt));
      return rows;
    }),

    getQuizData: protectedProcedure
      .input(z.object({ quizId: z.string() }))
      .handler(async ({ input, context }) => {
        const userId = context.user.id;
        const maxAttempts = 3;

        const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, input.quizId));
        if (!quiz) throw new ORPCError({ code: "NOT_FOUND", message: "Quiz not found." });

        const [enrollment] = await db
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, quiz.courseId)));
        if (!enrollment) throw new ORPCError({ code: "FORBIDDEN", message: "Not enrolled in this course." });

        // Oldest-first so attemptNumber = index + 1
        const submissions = await db
          .select()
          .from(quizSubmissions)
          .where(and(eq(quizSubmissions.userId, userId), eq(quizSubmissions.quizId, input.quizId)))
          .orderBy(asc(quizSubmissions.createdAt));

        const attemptCount = submissions.length;
        const allAttemptsUsed = attemptCount >= maxAttempts;

        // Best = highest score
        const bestSub = submissions.reduce<typeof submissions[0] | null>(
          (best, s) => (!best || s.score > best.score ? s : best),
          null,
        );

        // Review unlocks when passed OR all attempts exhausted (mirrors frontend gate)
        const shouldShowReview = allAttemptsUsed || (bestSub?.isPassed ?? false);

        // Per-question answers for best attempt — loaded whenever review is unlocked
        const bestAnswerMap: Record<string, { selectedOptionId: string; isCorrect: boolean }> = {};
        if (shouldShowReview && bestSub) {
          const answerRows = await db
            .select()
            .from(quizSubmissionAnswers)
            .where(eq(quizSubmissionAnswers.submissionId, bestSub.id));
          for (const a of answerRows) {
            bestAnswerMap[a.questionId] = { selectedOptionId: a.selectedOptionId, isCorrect: a.isCorrect };
          }
        }

        const questionRows = await db
          .select()
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, input.quizId))
          .orderBy(asc(quizQuestions.orderIndex));

        const questions = await Promise.all(
          questionRows.map(async (q) => {
            const opts = await db
              .select({ id: quizOptions.id, text: quizOptions.text, isCorrect: quizOptions.isCorrect })
              .from(quizOptions)
              .where(eq(quizOptions.questionId, q.id));
            return {
              id: q.id,
              question: q.question,
              type: q.type,
              orderIndex: q.orderIndex,
              options: opts.map((o) => ({
                id: o.id,
                text: o.text,
                isCorrect: shouldShowReview ? o.isCorrect : false,
                wasSelectedInBest: shouldShowReview ? (bestAnswerMap[q.id]?.selectedOptionId === o.id) : false,
              })),
            };
          }),
        );

        return {
          quiz: { id: quiz.id, title: quiz.title, description: quiz.description, passingScore: quiz.passingScore ?? 70 },
          questions,
          attemptCount,
          maxAttempts,
          allAttemptsUsed,
          submissions: submissions.map((s, i) => ({
            id: s.id,
            attemptNumber: i + 1,
            score: s.score,
            isPassed: s.isPassed,
            createdAt: s.createdAt,
          })),
          bestSubmission: bestSub
            ? { id: bestSub.id, score: bestSub.score, isPassed: bestSub.isPassed }
            : null,
        };
      }),

    submitQuiz: protectedProcedure
      .input(
        z.object({
          quizId: z.string(),
          answers: z.array(
            z.object({
              questionId: z.string(),
              optionId: z.string(),
            }),
          ),
        }),
      )
      .handler(async ({ input, context }) => {
        const userId = context.user.id;

        // Enforce 3-attempt limit
        const existingAttempts = await db
          .select({ id: quizSubmissions.id })
          .from(quizSubmissions)
          .where(and(eq(quizSubmissions.userId, userId), eq(quizSubmissions.quizId, input.quizId)));
        if (existingAttempts.length >= 3) {
          throw new ORPCError({ code: "FORBIDDEN", message: "You have used all 3 attempts for this quiz." });
        }

        const questionRows = await db
          .select()
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, input.quizId));

        let correctCount = 0;
        const answersToStore: { questionId: string; selectedOptionId: string; isCorrect: boolean }[] = [];

        for (const q of questionRows) {
          const [correctOption] = await db
            .select()
            .from(quizOptions)
            .where(and(eq(quizOptions.questionId, q.id), eq(quizOptions.isCorrect, true)));

          const studentAnswer = input.answers.find((a) => a.questionId === q.id);
          const isCorrect = !!(studentAnswer && studentAnswer.optionId === correctOption?.id);
          if (isCorrect) correctCount++;
          if (studentAnswer) {
            answersToStore.push({ questionId: q.id, selectedOptionId: studentAnswer.optionId, isCorrect });
          }
        }

        const score = questionRows.length > 0 ? (correctCount / questionRows.length) * 100 : 0;
        const [quizRow] = await db.select().from(quizzes).where(eq(quizzes.id, input.quizId));
        const isPassed = score >= (quizRow?.passingScore || 70);

        const [submission] = await db
          .insert(quizSubmissions)
          .values({ userId, quizId: input.quizId, score, isPassed })
          .returning();

        if (answersToStore.length > 0) {
          await db.insert(quizSubmissionAnswers).values(
            answersToStore.map((a) => ({ ...a, submissionId: submission.id })),
          );
        }

        return { ...submission, attemptCount: existingAttempts.length + 1 };
      }),

    checkEnrollment: protectedProcedure
      .input(z.object({ courseId: z.string() }))
      .handler(async ({ input, context }) => {
        const [enrollment] = await db
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, context.user.id), eq(enrollments.courseId, input.courseId)));
        return { isEnrolled: !!enrollment };
      }),

    submitReview: protectedProcedure
      .input(
        z.object({
          courseId: z.string(),
          rating: z.number().min(1).max(5),
          comment: z.string().optional(),
        }),
      )
      .handler(async ({ input, context }) => {
        const [enrollment] = await db
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, context.user.id), eq(enrollments.courseId, input.courseId)));

        if (!enrollment) throw new Error("You must be enrolled to submit a review");

        const [review] = await db
          .insert(reviews)
          .values({
            userId: context.user.id,
            courseId: input.courseId,
            rating: input.rating,
            comment: input.comment,
          })
          .onConflictDoUpdate({
            target: [reviews.userId, reviews.courseId],
            set: { rating: input.rating, comment: input.comment },
          })
          .returning();

        return review;
      }),

    // ── Initialize payment — validates courses, calculates server-side price, creates pending transaction ──
    initializePayment: protectedProcedure
      .input(z.object({
        courseIds: z.array(z.string()).min(1).max(20),
      }))
      .handler(async ({ input, context }) => {
        const userId = context.user.id;
        const email = context.user.email;

        // 1. Fetch courses from DB — never trust client prices
        const courseList = await db
          .select({ id: courses.id, title: courses.title, price: courses.price, discountPrice: courses.discountPrice, status: courses.status })
          .from(courses)
          .where(inArray(courses.id, input.courseIds));

        if (courseList.length === 0) throw new ORPCError({ code: "BAD_REQUEST", message: "No valid courses found." });

        // 2. Only PUBLISHED courses
        const unpublished = courseList.filter((c) => c.status !== "PUBLISHED");
        if (unpublished.length > 0) {
          const titles = unpublished.map((c) => `"${c.title}"`).join(", ");
          throw new ORPCError({ code: "BAD_REQUEST", message: `${unpublished.length > 1 ? "Some courses are" : `${titles} is`} not available for purchase. Please remove it from your cart.` });
        }

        // 3. Check for already-enrolled courses
        const existingEnrollments = await db
          .select({ courseId: enrollments.courseId })
          .from(enrollments)
          .where(and(eq(enrollments.userId, userId), inArray(enrollments.courseId, input.courseIds)));

        const alreadyEnrolledIds = new Set(existingEnrollments.map((e) => e.courseId));
        const purchasableCourses = courseList.filter((c) => !alreadyEnrolledIds.has(c.id));

        if (purchasableCourses.length === 0) throw new ORPCError({ code: "BAD_REQUEST", message: "You are already enrolled in all selected courses." });

        // 4. Separate free vs paid
        const freeCourses = purchasableCourses.filter((c) => {
          const eff = c.discountPrice != null && c.discountPrice > 0 ? c.discountPrice : c.price;
          return eff === 0;
        });
        const paidCourses = purchasableCourses.filter((c) => {
          const eff = c.discountPrice != null && c.discountPrice > 0 ? c.discountPrice : c.price;
          return eff > 0;
        });

        // 5. Auto-enroll free courses immediately
        if (freeCourses.length > 0) {
          await db.insert(enrollments).values(
            freeCourses.map((c) => ({ userId, courseId: c.id, accessType: "GRANTED" as const }))
          ).onConflictDoNothing();
        }

        // 6. If nothing to pay, return early
        if (paidCourses.length === 0) {
          return { type: "free" as const, enrolled: freeCourses.map((c) => c.id) };
        }

        // 7. Calculate total in kobo
        const subtotalNgn = paidCourses.reduce((sum, c) => {
          return sum + (c.discountPrice != null && c.discountPrice > 0 ? c.discountPrice : c.price);
        }, 0);
        const subtotalKobo = Math.round(subtotalNgn * 100);
        const serviceFeeKobo = calcServiceFee(subtotalKobo);
        const totalKobo = subtotalKobo + serviceFeeKobo;

        // 8. Generate unique reference
        const reference = `TXN-${userId.slice(0, 8)}-${Date.now()}-${nanoid(6)}`;

        // 9. Initialize with Paystack
        const paystackResult = await initializeTransaction({
          email,
          amountKobo: totalKobo,
          reference,
          metadata: {
            userId,
            courseIds: paidCourses.map((c) => c.id),
            courses: paidCourses.map((c) => ({ id: c.id, title: c.title })),
          },
        });

        // 10. Store pending transaction
        await db.insert(transactions).values({
          userId,
          courseIds: paidCourses.map((c) => c.id),
          amount: totalKobo,
          serviceFee: serviceFeeKobo,
          paystackReference: reference,
          paystackAccessCode: paystackResult.accessCode,
          status: "pending",
          metadata: {
            courses: paidCourses.map((c) => ({
              id: c.id,
              title: c.title,
              price: c.discountPrice != null && c.discountPrice > 0 ? c.discountPrice : c.price,
            })),
          },
        });

        return {
          type: "payment" as const,
          accessCode: paystackResult.accessCode,
          reference,
          amountKobo: totalKobo,
          subtotalKobo,
          serviceFeeKobo,
          freeEnrolled: freeCourses.map((c) => c.id),
        };
      }),

    // ── Verify payment — called by frontend after Paystack popup succeeds ──
    verifyPayment: protectedProcedure
      .input(z.object({ reference: z.string() }))
      .handler(async ({ input, context }) => {
        const userId = context.user.id;

        // 1. Fetch our transaction record
        const [txn] = await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.paystackReference, input.reference), eq(transactions.userId, userId)));

        if (!txn) throw new ORPCError({ code: "NOT_FOUND", message: "Transaction not found." });
        if (txn.status === "success") return { alreadyProcessed: true, enrolled: txn.courseIds };
        if (txn.status === "failed") throw new ORPCError({ code: "BAD_REQUEST", message: "This transaction failed. Please try again." });

        // 2. Verify with Paystack API
        const result = await verifyTransaction(input.reference);

        if (result.status !== "success") {
          await db.update(transactions).set({ status: "failed" }).where(eq(transactions.id, txn.id));
          throw new ORPCError({ code: "BAD_REQUEST", message: "Payment was not successful. Please try again." });
        }

        // 3. Verify amount matches — prevent amount tampering
        if (result.amountKobo !== txn.amount) {
          await db.update(transactions).set({ status: "failed" }).where(eq(transactions.id, txn.id));
          throw new ORPCError({ code: "BAD_REQUEST", message: "Payment amount mismatch. Contact support." });
        }

        // 4. Enroll student in all paid courses
        await db.insert(enrollments).values(
          txn.courseIds.map((courseId) => ({ userId, courseId, accessType: "PURCHASE" as const }))
        ).onConflictDoNothing();

        // 5. Mark transaction success
        await db.update(transactions)
          .set({ status: "success", verifiedAt: new Date() })
          .where(eq(transactions.id, txn.id));

        return { alreadyProcessed: false, enrolled: txn.courseIds };
      }),

    // ── Fetch full course curriculum + per-lesson progress for enrolled student ──
    getCourseLearnData: protectedProcedure
      .input(z.object({ courseId: z.string() }))
      .handler(async ({ input, context }) => {
        const userId = context.user.id;

        const [enrollment] = await db
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, input.courseId)));

        if (!enrollment) throw new ORPCError({ code: "FORBIDDEN", message: "You are not enrolled in this course." });

        const [course] = await db
          .select({ id: courses.id, title: courses.title, thumbnailUrl: courses.thumbnailUrl })
          .from(courses)
          .where(eq(courses.id, input.courseId));

        if (!course) throw new ORPCError({ code: "NOT_FOUND", message: "Course not found." });

        const rows = await db
          .select({
            chapterId: chapters.id,
            chapterTitle: chapters.title,
            chapterOrder: chapters.orderIndex,
            lessonId: lessons.id,
            lessonTitle: lessons.title,
            lessonType: lessons.type,
            lessonOrder: lessons.orderIndex,
            lessonDuration: lessons.durationSeconds,
            muxPlaybackId: lessons.muxPlaybackId,
            fileUrl: lessons.fileUrl,
            fileName: lessons.fileName,
            description: lessons.description,
            isFree: lessons.isFree,
            lessonQuizId: lessons.quizId,
            isCompleted: sql<boolean>`coalesce(${videoProgress.isCompleted}, false)`,
            secondsWatched: sql<number>`coalesce(${videoProgress.secondsWatched}, 0)`,
          })
          .from(chapters)
          .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
          .leftJoin(videoProgress, and(eq(videoProgress.lessonId, lessons.id), eq(videoProgress.userId, userId)))
          .where(eq(chapters.courseId, input.courseId))
          .orderBy(asc(chapters.orderIndex), asc(lessons.orderIndex));

        const chapterMap = new Map<string, { id: string; title: string; orderIndex: number; lessons: any[] }>();
        for (const row of rows) {
          if (!chapterMap.has(row.chapterId)) {
            chapterMap.set(row.chapterId, { id: row.chapterId, title: row.chapterTitle, orderIndex: row.chapterOrder, lessons: [] });
          }
          chapterMap.get(row.chapterId)!.lessons.push({
            id: row.lessonId,
            title: row.lessonTitle,
            type: row.lessonType,
            orderIndex: row.lessonOrder,
            durationSeconds: row.lessonDuration,
            muxPlaybackId: row.muxPlaybackId,
            fileUrl: row.fileUrl,
            fileName: row.fileName,
            description: row.description,
            isFree: row.isFree,
            isCompleted: row.isCompleted,
            secondsWatched: row.secondsWatched,
            quizId: row.lessonQuizId,
          });
        }

        const chaptersList = [...chapterMap.values()];
        const totalLessons = chaptersList.reduce((sum, c) => sum + c.lessons.length, 0);
        const completedLessons = chaptersList.reduce((sum, c) => sum + c.lessons.filter((l: any) => l.isCompleted).length, 0);

        return { course, chapters: chaptersList, totalLessons, completedLessons };
      }),

    // ── Manually toggle lesson completion ──
    markLessonComplete: protectedProcedure
      .input(z.object({ lessonId: z.string(), completed: z.boolean() }))
      .handler(async ({ input, context }) => {
        const userId = context.user.id;
        await db
          .insert(videoProgress)
          .values({ userId, lessonId: input.lessonId, isCompleted: input.completed, secondsWatched: 0, lastWatchedAt: new Date() })
          .onConflictDoUpdate({
            target: [videoProgress.userId, videoProgress.lessonId],
            set: { isCompleted: input.completed, lastWatchedAt: new Date() },
          });
        return { isCompleted: input.completed };
      }),

    // ── Save video position; auto-completes at 80% watched ──
    updateVideoProgress: protectedProcedure
      .input(z.object({ lessonId: z.string(), secondsWatched: z.number(), duration: z.number() }))
      .handler(async ({ input, context }) => {
        const userId = context.user.id;
        const autoComplete = input.duration > 0 && input.secondsWatched >= input.duration * 0.8;
        await db
          .insert(videoProgress)
          .values({ userId, lessonId: input.lessonId, secondsWatched: input.secondsWatched, isCompleted: autoComplete, lastWatchedAt: new Date() })
          .onConflictDoUpdate({
            target: [videoProgress.userId, videoProgress.lessonId],
            set: {
              secondsWatched: input.secondsWatched,
              isCompleted: sql`CASE WHEN ${videoProgress.isCompleted} = true THEN true ELSE ${autoComplete} END`,
              lastWatchedAt: new Date(),
            },
          });
        return { isCompleted: autoComplete };
      }),
  }),
});

// Export the inferred type for the frontend Client
export type AppRouter = typeof appRouter;
