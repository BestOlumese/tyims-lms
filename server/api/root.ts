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
  transactionItems,
  videoProgress,
  notifications,
  instructorPayoutAccounts,
  payouts as payoutsTable,
} from "@/lib/db/schema";
import {
  nairaToKobo,
  effectivePriceNaira,
  splitLine,
} from "@/lib/revenue";
import { notify, notifyAdmins, notifyPurchaseSucceeded, notifyPaymentFailed, notifyPayoutQueued, notifyBankAccountReview } from "@/lib/notifications";
import { creditTransaction, getBalance, getLedger, reverseSale } from "@/lib/payouts/ledger";
import {
  checkEligibility,
  createWithdrawal,
  quoteWithdrawal,
  settlePayout,
} from "@/lib/payouts/withdraw";
import {
  getPinStatus,
  hasTransactionPin,
  setTransactionPin,
  verifyTransactionPin,
  isValidPinFormat,
  isWeakPin,
  clearPinLockout,
} from "@/lib/payouts/pin";
import {
  listBanks,
  resolveAccount,
  createTransferRecipient,
  maskAccountNumber,
} from "@/lib/payouts/paystack-transfers";
import { dispatchPayout } from "@/lib/payouts/dispatch";
import { compareNames } from "@/lib/payouts/name-match";
import { mailPinChanged, mailBankAccountChanged } from "@/lib/mail";
import {
  getMinPayoutKobo,
  getAutoApproveMaxKobo,
  getHoldDays,
  NAME_MATCH_AUTO_APPROVE,
  PIN_LENGTH,
} from "@/lib/payouts/config";
import { count, eq, ne, sql, desc, asc, and, ilike, or, gt, inArray } from "drizzle-orm";
import { calcServiceFee, initializeTransaction, verifyTransaction } from "@/lib/paystack";
import { nanoid } from "nanoid";

// 1. Base Builder
const pub = os.$context<Context>();

// 2. Middlewares (The Gatekeepers)
// Throw ORPCError, not plain Error: a plain Error surfaces to the client as a generic
// 500 with its message leaked, so the UI cannot tell "logged out" from "server broke".
// ORPCError maps to a proper 401/403 the client can branch on.
const protectedProcedure = pub.use(({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", { message: "You must be signed in." });
  }
  return next({ context: { user: context.user } });
});

const adminProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.user.role !== "ADMIN") {
    throw new ORPCError("FORBIDDEN", { message: "Admins only." });
  }
  return next({ context: { user: context.user } });
});

const instructorProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.user.role !== "INSTRUCTOR" && context.user.role !== "ADMIN") {
    throw new ORPCError("FORBIDDEN", { message: "Instructors only." });
  }
  return next({ context: { user: context.user } });
});

// ── Revenue analytics helpers ────────────────────────────────────────────────
// Shared by the instructor and admin analytics procedures so the two can never
// disagree: same source rows, same filters, same money maths.

const revenueRangeSchema = z.object({
  /** ISO date strings. Omit for the last 30 days. */
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: z.enum(["day", "week", "month"]).optional().default("day"),
});

type ResolvedRange = {
  from: Date;
  to: Date;
  /** Same length immediately before `from`, for period-over-period comparison. */
  prevFrom: Date;
  prevTo: Date;
  granularity: "day" | "week" | "month";
};

function resolveRange(input?: z.infer<typeof revenueRangeSchema>): ResolvedRange {
  const to = input?.to ? new Date(input.to) : new Date();
  const from = input?.from
    ? new Date(input.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const span = to.getTime() - from.getTime();
  return {
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    granularity: input?.granularity ?? "day",
  };
}

/**
 * Only `success` transactions count as revenue, and they're dated by `verifiedAt`
 * (when the money actually cleared) rather than `createdAt` (when checkout started).
 */
function successInWindow(fromDate: Date, toDate: Date) {
  return and(
    eq(transactions.status, "success"),
    sql`${transactions.verifiedAt} >= ${fromDate.toISOString()}`,
    sql`${transactions.verifiedAt} <= ${toDate.toISOString()}`,
  );
}

async function sumRevenue(
  fromDate: Date,
  toDate: Date,
  scope?: ReturnType<typeof eq>,
) {
  const [row] = await db
    .select({
      grossKobo: sql<number>`coalesce(sum(${transactionItems.unitPriceKobo}), 0)::bigint`,
      platformFeeKobo: sql<number>`coalesce(sum(${transactionItems.platformFeeKobo}), 0)::bigint`,
      netKobo: sql<number>`coalesce(sum(${transactionItems.instructorEarningKobo}), 0)::bigint`,
      salesCount: sql<number>`count(*)::int`,
      orderCount: sql<number>`count(distinct ${transactionItems.transactionId})::int`,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(scope ? and(successInWindow(fromDate, toDate), scope) : successInWindow(fromDate, toDate));

  return {
    grossKobo: Number(row?.grossKobo ?? 0),
    platformFeeKobo: Number(row?.platformFeeKobo ?? 0),
    netKobo: Number(row?.netKobo ?? 0),
    salesCount: Number(row?.salesCount ?? 0),
    orderCount: Number(row?.orderCount ?? 0),
  };
}

async function buildRevenueAnalytics(
  range: ResolvedRange,
  scope: ReturnType<typeof eq> | undefined,
  opts: { includeInstructors: boolean },
) {
  const where = scope
    ? and(successInWindow(range.from, range.to), scope)
    : successInWindow(range.from, range.to);

  const [current, previous] = await Promise.all([
    sumRevenue(range.from, range.to, scope),
    sumRevenue(range.prevFrom, range.prevTo, scope),
  ]);

  // Time series. date_trunc keeps bucketing in the database rather than shipping
  // every row to Node just to group it.
  //
  // The granularity is inlined with sql.raw rather than bound as a parameter: Postgres
  // cannot prove a parameterised `date_trunc($1, col)` in GROUP BY is the same expression
  // as the one in SELECT, and rejects the query with
  //   "column transaction.verified_at must appear in the GROUP BY clause".
  // Safe to inline because `granularity` comes from a z.enum — only day|week|month.
  const bucketExpr = sql`date_trunc(${sql.raw(`'${range.granularity}'`)}, ${transactions.verifiedAt})`;

  const series = await db
    .select({
      bucket: sql<string>`${bucketExpr}::date::text`,
      grossKobo: sql<number>`coalesce(sum(${transactionItems.unitPriceKobo}), 0)::bigint`,
      netKobo: sql<number>`coalesce(sum(${transactionItems.instructorEarningKobo}), 0)::bigint`,
      salesCount: sql<number>`count(*)::int`,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .where(where)
    .groupBy(bucketExpr)
    .orderBy(bucketExpr);

  const topCourses = await db
    .select({
      courseId: transactionItems.courseId,
      title: courses.title,
      thumbnailUrl: courses.thumbnailUrl,
      salesCount: sql<number>`count(*)::int`,
      grossKobo: sql<number>`coalesce(sum(${transactionItems.unitPriceKobo}), 0)::bigint`,
      netKobo: sql<number>`coalesce(sum(${transactionItems.instructorEarningKobo}), 0)::bigint`,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .leftJoin(courses, eq(courses.id, transactionItems.courseId))
    .where(where)
    .groupBy(transactionItems.courseId, courses.title, courses.thumbnailUrl)
    .orderBy(desc(sql`sum(${transactionItems.unitPriceKobo})`))
    .limit(10);

  const recentTransactions = await db
    .select({
      itemId: transactionItems.id,
      transactionId: transactionItems.transactionId,
      reference: transactions.paystackReference,
      verifiedAt: transactions.verifiedAt,
      buyerName: users.name,
      buyerEmail: users.email,
      courseTitle: courses.title,
      grossKobo: transactionItems.unitPriceKobo,
      platformFeeKobo: transactionItems.platformFeeKobo,
      netKobo: transactionItems.instructorEarningKobo,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
    .leftJoin(courses, eq(courses.id, transactionItems.courseId))
    .leftJoin(users, eq(users.id, transactions.userId))
    .where(where)
    .orderBy(desc(transactions.verifiedAt))
    .limit(100);

  let byInstructor: {
    instructorId: string;
    name: string | null;
    salesCount: number;
    grossKobo: number;
    platformFeeKobo: number;
    netKobo: number;
  }[] = [];

  if (opts.includeInstructors) {
    const rows = await db
      .select({
        instructorId: transactionItems.instructorId,
        name: users.name,
        salesCount: sql<number>`count(*)::int`,
        grossKobo: sql<number>`coalesce(sum(${transactionItems.unitPriceKobo}), 0)::bigint`,
        platformFeeKobo: sql<number>`coalesce(sum(${transactionItems.platformFeeKobo}), 0)::bigint`,
        netKobo: sql<number>`coalesce(sum(${transactionItems.instructorEarningKobo}), 0)::bigint`,
      })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
      .leftJoin(users, eq(users.id, transactionItems.instructorId))
      .where(where)
      .groupBy(transactionItems.instructorId, users.name)
      .orderBy(desc(sql`sum(${transactionItems.unitPriceKobo})`));

    byInstructor = rows.map((r) => ({
      instructorId: r.instructorId,
      name: r.name,
      salesCount: Number(r.salesCount),
      grossKobo: Number(r.grossKobo),
      platformFeeKobo: Number(r.platformFeeKobo),
      netKobo: Number(r.netKobo),
    }));
  }

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity: range.granularity,
    },
    current,
    previous,
    series: series.map((s) => ({
      bucket: s.bucket,
      grossKobo: Number(s.grossKobo),
      netKobo: Number(s.netKobo),
      salesCount: Number(s.salesCount),
    })),
    topCourses: topCourses.map((c) => ({
      courseId: c.courseId,
      title: c.title,
      thumbnailUrl: c.thumbnailUrl,
      salesCount: Number(c.salesCount),
      grossKobo: Number(c.grossKobo),
      netKobo: Number(c.netKobo),
    })),
    recentTransactions,
    byInstructor,
  };
}

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

  // Public: featured instructors for the homepage carousel.
  // Only instructors who actually have something to show — at least one PUBLISHED
  // course — so the homepage never renders an empty instructor card.
  getFeaturedInstructors: pub
    .input(z.object({ limit: z.number().min(1).max(20).optional().default(8) }).optional())
    .handler(async ({ input }) => {
      const limit = input?.limit ?? 8;

      const publishedCourseCount = sql<number>`(SELECT count(*)::int FROM "course" c WHERE c.instructor_id = "user"."id" AND c.status = 'PUBLISHED')`;
      const avgRating = sql<number>`coalesce((SELECT avg(r.rating)::float FROM "review" r INNER JOIN "course" c ON r.course_id = c.id WHERE c.instructor_id = "user"."id"), 0)`;
      const studentCount = sql<number>`(SELECT count(*)::int FROM "enrollment" e INNER JOIN "course" c ON e.course_id = c.id WHERE c.instructor_id = "user"."id")`;

      return await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
          title: users.title,
          bio: users.aboutMe,
          courseCount: publishedCourseCount,
          studentCount,
          avgRating,
        })
        .from(users)
        .where(and(eq(users.role, "INSTRUCTOR"), gt(publishedCourseCount, 0)))
        .orderBy(desc(avgRating), desc(studentCount))
        .limit(limit);
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

      // Real platform revenue. This was hardcoded `totalRevenue: 0` with the comment
      // "Placeholder until payments are integrated" — but Paystack is integrated, so the
      // admin dashboard has been reporting ₦0 on a live payment system.
      const [platform] = await db
        .select({
          grossKobo: sql<number>`coalesce(sum(${transactionItems.unitPriceKobo}), 0)::bigint`,
          platformFeeKobo: sql<number>`coalesce(sum(${transactionItems.platformFeeKobo}), 0)::bigint`,
          instructorEarningsKobo: sql<number>`coalesce(sum(${transactionItems.instructorEarningKobo}), 0)::bigint`,
        })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
        .where(eq(transactions.status, "success"));

      const [txnCounts] = await db
        .select({
          successful: sql<number>`count(*) filter (where ${transactions.status} = 'success')::int`,
          pending: sql<number>`count(*) filter (where ${transactions.status} = 'pending')::int`,
          failed: sql<number>`count(*) filter (where ${transactions.status} = 'failed')::int`,
          paystackFeesKobo: sql<number>`coalesce(sum(${transactions.serviceFee}) filter (where ${transactions.status} = 'success'), 0)::bigint`,
        })
        .from(transactions);

      return {
        totalUsers: userCount?.value || 0,
        totalCourses: courseCount?.value || 0,
        totalEnrollments: enrollmentCount?.value || 0,
        // Gross value of goods sold, excluding the Paystack fee (which is not ours).
        totalRevenue: Number(platform?.grossKobo ?? 0),
        grossKobo: Number(platform?.grossKobo ?? 0),
        platformEarningsKobo: Number(platform?.platformFeeKobo ?? 0),
        instructorEarningsKobo: Number(platform?.instructorEarningsKobo ?? 0),
        paystackFeesKobo: Number(txnCounts?.paystackFeesKobo ?? 0),
        successfulTransactions: Number(txnCounts?.successful ?? 0),
        pendingTransactions: Number(txnCounts?.pending ?? 0),
        failedTransactions: Number(txnCounts?.failed ?? 0),
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
      .handler(async ({ input, context }) => {
        // updatedAt must be bumped: getPendingInstructors orders by it, so without this
        // a processed application never moves in the list.
        if (input.action === "APPROVE") {
          await db
            .update(users)
            .set({
              role: "INSTRUCTOR",
              instructorRequestStatus: "APPROVED",
              updatedAt: new Date(),
            })
            .where(eq(users.id, input.userId));
        } else {
          await db
            .update(users)
            .set({
              instructorRequestStatus: "REJECTED",
              updatedAt: new Date(),
            })
            .where(eq(users.id, input.userId));
        }

        // Close the loop for the applicant — they had no way of knowing the outcome.
        await notify({
          recipientId: input.userId,
          type: input.action === "APPROVE" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
          title:
            input.action === "APPROVE"
              ? "You're now an instructor"
              : "Your instructor application was not approved",
          body:
            input.action === "APPROVE"
              ? "You can now create and publish courses from your instructor dashboard."
              : "You can update your details and apply again at any time.",
          link: input.action === "APPROVE" ? "/instructor" : "/become-instructor",
          entityType: "user",
          entityId: input.userId,
          actorId: context.user.id,
        });

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

      if (courseIds.length > 0) {
        const [enrollmentCount] = await db
          .select({ value: count() })
          .from(enrollments)
          .where(inArray(enrollments.courseId, courseIds));
        totalStudents = enrollmentCount?.value || 0;
      }

      // Revenue comes from paid transaction line items — never from enrolments.
      //
      // This previously summed each enrolment × the course's CURRENT price, which:
      //   · counted seeded/granted enrolments that were never paid for
      //     (this database has 93 enrolments but only 1 successful transaction)
      //   · silently rewrote history whenever a price was edited
      //   · ignored the platform's commission entirely
      const [earnings] = await db
        .select({
          grossKobo: sql<number>`coalesce(sum(${transactionItems.unitPriceKobo}), 0)::bigint`,
          platformFeeKobo: sql<number>`coalesce(sum(${transactionItems.platformFeeKobo}), 0)::bigint`,
          netKobo: sql<number>`coalesce(sum(${transactionItems.instructorEarningKobo}), 0)::bigint`,
          salesCount: sql<number>`count(*)::int`,
        })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
        .where(
          and(
            eq(transactionItems.instructorId, instructorId),
            eq(transactions.status, "success"),
          ),
        );

      // Recent sales, for the overview list.
      const recentSales = await db
        .select({
          transactionId: transactionItems.transactionId,
          courseId: transactionItems.courseId,
          courseTitle: courses.title,
          buyerName: users.name,
          earningKobo: transactionItems.instructorEarningKobo,
          createdAt: transactions.verifiedAt,
        })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
        .leftJoin(courses, eq(courses.id, transactionItems.courseId))
        .leftJoin(users, eq(users.id, transactions.userId))
        .where(
          and(
            eq(transactionItems.instructorId, instructorId),
            eq(transactions.status, "success"),
          ),
        )
        .orderBy(desc(transactions.verifiedAt))
        .limit(5);

      return {
        totalCourses: courseStats?.value || 0,
        totalStudents,
        // Kept for backwards compatibility with the existing overview card, now in kobo
        // and reflecting the instructor's actual net earnings.
        totalRevenue: Number(earnings?.netKobo ?? 0),
        grossKobo: Number(earnings?.grossKobo ?? 0),
        platformFeeKobo: Number(earnings?.platformFeeKobo ?? 0),
        netKobo: Number(earnings?.netKobo ?? 0),
        salesCount: Number(earnings?.salesCount ?? 0),
        recentSales,
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

  // --- REVENUE ANALYTICS ---
  // Both procedures read the same `transaction_item` rows joined to successful
  // transactions, so admin totals and the sum of instructor totals always agree.
  revenue: pub.router({
    /** Instructor: own earnings only. Scoped by instructorId server-side. */
    instructorAnalytics: instructorProcedure
      .input(revenueRangeSchema.optional())
      .handler(async ({ input, context }) => {
        const range = resolveRange(input);
        const scope = eq(transactionItems.instructorId, context.user.id);
        return await buildRevenueAnalytics(range, scope, { includeInstructors: false });
      }),

    /** Admin: platform-wide, plus a per-instructor breakdown. */
    adminAnalytics: adminProcedure
      .input(revenueRangeSchema.optional())
      .handler(async ({ input }) => {
        const range = resolveRange(input);
        return await buildRevenueAnalytics(range, undefined, { includeInstructors: true });
      }),
  }),

  // --- DASHBOARD SEARCH ---
  /**
   * Powers the top-bar search, which previously did nothing at all.
   *
   * Scoping is decided here from context.user.role — never from a client-supplied flag.
   * An instructor only ever gets rows tied to their own courses; there is no input that
   * lets them widen it.
   */
  dashboardSearch: protectedProcedure
    .input(z.object({ q: z.string().trim().min(1).max(100) }))
    .handler(async ({ input, context }) => {
      const term = `%${input.q}%`;
      const LIMIT = 5;
      const role = context.user.role;

      type Group = {
        label: string;
        items: { id: string; title: string; subtitle?: string | null; href: string }[];
      };
      const groups: Group[] = [];

      if (role === "ADMIN") {
        const [userRows, courseRows, categoryRows, txnRows] = await Promise.all([
          db
            .select({ id: users.id, name: users.name, email: users.email, role: users.role })
            .from(users)
            .where(or(ilike(users.name, term), ilike(users.email, term)))
            .limit(LIMIT),
          db
            .select({ id: courses.id, title: courses.title, status: courses.status, instructor: users.name })
            .from(courses)
            .leftJoin(users, eq(users.id, courses.instructorId))
            .where(ilike(courses.title, term))
            .limit(LIMIT),
          db
            .select({ id: categories.id, name: categories.name, slug: categories.slug })
            .from(categories)
            .where(or(ilike(categories.name, term), ilike(categories.slug, term)))
            .limit(LIMIT),
          db
            .select({
              id: transactions.id,
              reference: transactions.paystackReference,
              status: transactions.status,
              amount: transactions.amount,
              buyer: users.name,
            })
            .from(transactions)
            .leftJoin(users, eq(users.id, transactions.userId))
            .where(or(ilike(transactions.paystackReference, term), ilike(users.name, term)))
            .limit(LIMIT),
        ]);

        if (userRows.length)
          groups.push({
            label: "Users",
            items: userRows.map((u) => ({
              id: u.id,
              title: u.name,
              subtitle: `${u.email} · ${u.role}`,
              href: "/admin/users",
            })),
          });
        if (courseRows.length)
          groups.push({
            label: "Courses",
            items: courseRows.map((c) => ({
              id: c.id,
              title: c.title,
              subtitle: `${c.status}${c.instructor ? ` · ${c.instructor}` : ""}`,
              href: "/admin/courses",
            })),
          });
        if (categoryRows.length)
          groups.push({
            label: "Categories",
            items: categoryRows.map((c) => ({
              id: c.id,
              title: c.name,
              subtitle: c.slug,
              href: "/admin/categories",
            })),
          });
        if (txnRows.length)
          groups.push({
            label: "Transactions",
            items: txnRows.map((t) => ({
              id: t.id,
              title: t.reference,
              subtitle: `${t.status}${t.buyer ? ` · ${t.buyer}` : ""}`,
              href: "/admin/revenue",
            })),
          });

        return { groups };
      }

      // INSTRUCTOR (and ADMIN acting as instructor is covered above).
      // Every query below is constrained to courses owned by this user.
      const instructorId = context.user.id;

      const ownCourseIds = (
        await db
          .select({ id: courses.id })
          .from(courses)
          .where(eq(courses.instructorId, instructorId))
      ).map((c) => c.id);

      const courseRows = await db
        .select({ id: courses.id, title: courses.title, status: courses.status })
        .from(courses)
        .where(and(eq(courses.instructorId, instructorId), ilike(courses.title, term)))
        .limit(LIMIT);

      if (courseRows.length)
        groups.push({
          label: "My courses",
          items: courseRows.map((c) => ({
            id: c.id,
            title: c.title,
            subtitle: c.status,
            href: `/instructor/courses/${c.id}`,
          })),
        });

      if (ownCourseIds.length > 0) {
        const [studentRows, reviewRows] = await Promise.all([
          db
            .selectDistinct({ id: users.id, name: users.name, email: users.email })
            .from(enrollments)
            .innerJoin(users, eq(users.id, enrollments.userId))
            .where(
              and(
                inArray(enrollments.courseId, ownCourseIds),
                or(ilike(users.name, term), ilike(users.email, term)),
              ),
            )
            .limit(LIMIT),
          db
            .select({
              id: reviews.id,
              rating: reviews.rating,
              comment: reviews.comment,
              courseId: reviews.courseId,
              courseTitle: courses.title,
              author: users.name,
            })
            .from(reviews)
            .innerJoin(courses, eq(courses.id, reviews.courseId))
            .leftJoin(users, eq(users.id, reviews.userId))
            .where(
              and(
                inArray(reviews.courseId, ownCourseIds),
                or(ilike(reviews.comment, term), ilike(users.name, term)),
              ),
            )
            .limit(LIMIT),
        ]);

        if (studentRows.length)
          groups.push({
            label: "Students",
            items: studentRows.map((s) => ({
              id: s.id,
              title: s.name,
              subtitle: s.email,
              href: `/instructor/enrollments/${s.id}`,
            })),
          });

        if (reviewRows.length)
          groups.push({
            label: "Reviews",
            items: reviewRows.map((r) => ({
              id: r.id,
              title: `${"★".repeat(r.rating)} ${r.courseTitle}`,
              subtitle: r.comment?.slice(0, 60) || r.author,
              href: `/instructor/reviews/${r.courseId}`,
            })),
          });
      }

      return { groups };
    }),

  // --- PAYOUTS ---
  // Everything here moves or gates money. Rules:
  //   · scoped to context.user.id — an instructor can only ever touch their own records
  //   · never return the PIN hash, the recipient code, or a full account number
  //   · the server recomputes every amount; a client-supplied figure is only a request
  payouts: pub.router({
    /** Banks for the account picker. */
    getBanks: instructorProcedure.handler(async () => {
      return await listBanks();
    }),

    /** Balance + the gates blocking withdrawal, for rendering the page. */
    getOverview: instructorProcedure.handler(async ({ context }) => {
      const [balance, eligibility, pinStatus, account] = await Promise.all([
        getBalance(context.user.id),
        checkEligibility(context.user.id),
        getPinStatus(context.user.id),
        db
          .select({
            bankName: instructorPayoutAccounts.bankName,
            accountName: instructorPayoutAccounts.accountName,
            accountNumber: instructorPayoutAccounts.accountNumber,
            verifiedAt: instructorPayoutAccounts.verifiedAt,
            nameMatchScore: instructorPayoutAccounts.nameMatchScore,
          })
          .from(instructorPayoutAccounts)
          .where(eq(instructorPayoutAccounts.instructorId, context.user.id))
          .then((r) => r[0] ?? null),
      ]);

      return {
        balance,
        eligibility,
        pin: { isSet: pinStatus.isSet, isLocked: pinStatus.isLocked, lockedUntil: pinStatus.lockedUntil },
        // Masked — the full number is never sent to the browser.
        account: account
          ? {
              bankName: account.bankName,
              accountName: account.accountName,
              accountNumberMasked: maskAccountNumber(account.accountNumber),
              verified: Boolean(account.verifiedAt),
              nameMatchScore: account.nameMatchScore,
            }
          : null,
        limits: {
          minKobo: getMinPayoutKobo(),
          autoApproveMaxKobo: getAutoApproveMaxKobo(),
          holdDays: getHoldDays(),
        },
      };
    }),

    /**
     * Look up who really owns an account, WITHOUT saving anything.
     * Lets the instructor see the account name before committing.
     */
    resolveAccount: instructorProcedure
      .input(
        z.object({
          accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits."),
          bankCode: z.string().min(1),
        }),
      )
      .handler(async ({ input, context }) => {
        const resolved = await resolveAccount(input.accountNumber, input.bankCode);
        if (!resolved.ok) {
          throw new ORPCError("BAD_REQUEST", { message: resolved.message });
        }

        const [me] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, context.user.id));

        const match = compareNames(me?.name ?? "", resolved.account.accountName);

        return {
          accountName: resolved.account.accountName,
          matchScore: match.score,
          willAutoVerify: match.score >= NAME_MATCH_AUTO_APPROVE,
          matchReason: match.reason,
        };
      }),

    /**
     * Save the bank account. Re-resolves server-side — the account name is never taken
     * from the client, so a tampered request cannot register someone else's account under
     * a matching name.
     */
    saveAccount: instructorProcedure
      .input(
        z.object({
          accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits."),
          bankCode: z.string().min(1),
          bankName: z.string().min(1),
        }),
      )
      .handler(async ({ input, context }) => {
        // Bank details cannot change while money is in flight to the old account.
        const [inFlight] = await db
          .select({ value: count() })
          .from(payoutsTable)
          .where(
            and(
              eq(payoutsTable.instructorId, context.user.id),
              sql`${payoutsTable.status} IN ('REQUESTED', 'PROCESSING')`,
            ),
          );
        if ((inFlight?.value ?? 0) > 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "You can't change bank details while a withdrawal is in progress.",
          });
        }

        const resolved = await resolveAccount(input.accountNumber, input.bankCode);
        if (!resolved.ok) {
          throw new ORPCError("BAD_REQUEST", { message: resolved.message });
        }

        const [me] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, context.user.id));

        const match = compareNames(me?.name ?? "", resolved.account.accountName);
        const autoVerify = match.score >= NAME_MATCH_AUTO_APPROVE;

        // Only create a Paystack recipient once we're happy about the name.
        let recipientCode: string | null = null;
        if (autoVerify) {
          const recipient = await createTransferRecipient({
            name: resolved.account.accountName,
            accountNumber: input.accountNumber,
            bankCode: input.bankCode,
          });
          if (!recipient.ok) {
            throw new ORPCError("BAD_REQUEST", { message: recipient.message });
          }
          recipientCode = recipient.recipientCode;
        }

        await db
          .insert(instructorPayoutAccounts)
          .values({
            instructorId: context.user.id,
            bankCode: input.bankCode,
            bankName: input.bankName,
            accountNumber: input.accountNumber,
            accountName: resolved.account.accountName,
            nameMatchScore: match.score,
            recipientCode,
            verifiedAt: autoVerify ? new Date() : null,
          })
          .onConflictDoUpdate({
            target: instructorPayoutAccounts.instructorId,
            set: {
              bankCode: input.bankCode,
              bankName: input.bankName,
              accountNumber: input.accountNumber,
              accountName: resolved.account.accountName,
              nameMatchScore: match.score,
              recipientCode,
              verifiedAt: autoVerify ? new Date() : null,
              manuallyApproved: false,
              updatedAt: new Date(),
            },
          });

        if (me?.email) {
          await mailBankAccountChanged(
            me.email,
            me.name ?? "there",
            input.bankName,
            maskAccountNumber(input.accountNumber),
          );
        }

        if (!autoVerify) {
          await notifyBankAccountReview({
            instructorId: context.user.id,
            instructorName: me?.name ?? "An instructor",
            accountName: resolved.account.accountName,
            score: match.score,
          });
        }

        return {
          accountName: resolved.account.accountName,
          verified: autoVerify,
          matchScore: match.score,
          message: autoVerify
            ? "Bank account verified."
            : "Saved. The account name doesn't closely match your profile name, so an admin will review it.",
        };
      }),

    /** Set the transaction PIN for the first time. */
    setPin: instructorProcedure
      .input(z.object({ pin: z.string() }))
      .handler(async ({ input, context }) => {
        if (!isValidPinFormat(input.pin)) {
          throw new ORPCError("BAD_REQUEST", { message: `Your PIN must be ${PIN_LENGTH} digits.` });
        }
        if (isWeakPin(input.pin)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Choose a less predictable PIN — avoid repeated or sequential digits.",
          });
        }
        if (await hasTransactionPin(context.user.id)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "You already have a PIN. Use change PIN instead.",
          });
        }

        await setTransactionPin(context.user.id, input.pin);

        // Out-of-band notice: someone holding a hijacked session would otherwise be the
        // only person who ever knows a withdrawal PIN now exists.
        const [me] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, context.user.id));
        if (me?.email) await mailPinChanged(me.email, me.name ?? "there");

        return { success: true };
      }),

    /**
     * Change the PIN. Requires the CURRENT pin.
     *
     * Note: the agreed design said "requires the account password", but better-auth does
     * not expose a server-side password check without minting a session. Requiring the
     * current PIN is the equivalent guarantee (you must already hold the secret), and a
     * forgotten PIN is recoverable by an admin.
     */
    changePin: instructorProcedure
      .input(z.object({ currentPin: z.string(), newPin: z.string() }))
      .handler(async ({ input, context }) => {
        if (!isValidPinFormat(input.newPin)) {
          throw new ORPCError("BAD_REQUEST", { message: `Your PIN must be ${PIN_LENGTH} digits.` });
        }
        if (isWeakPin(input.newPin)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Choose a less predictable PIN — avoid repeated or sequential digits.",
          });
        }

        const check = await verifyTransactionPin(context.user.id, input.currentPin);
        if (!check.ok) throw new ORPCError("BAD_REQUEST", { message: check.message });

        await setTransactionPin(context.user.id, input.newPin);

        const [me] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, context.user.id));
        if (me?.email) await mailPinChanged(me.email, me.name ?? "there");

        return { success: true };
      }),

    /** Fee breakdown, so the instructor sees exactly what lands before confirming. */
    quote: instructorProcedure
      .input(z.object({ amountKobo: z.number().int().positive() }))
      .handler(async ({ input }) => {
        return quoteWithdrawal(input.amountKobo);
      }),

    /** Request a withdrawal, and dispatch immediately if under the auto-approve limit. */
    requestWithdrawal: instructorProcedure
      .input(
        z.object({
          amountKobo: z.number().int().positive(),
          pin: z.string(),
        }),
      )
      .handler(async ({ input, context }) => {
        const result = await createWithdrawal({
          instructorId: context.user.id,
          amountKobo: input.amountKobo,
          pin: input.pin,
        });

        if (!result.ok) {
          throw new ORPCError("BAD_REQUEST", { message: result.message });
        }

        if (result.autoApproved) {
          // Under the threshold — send it now. A dispatch failure settles the payout as
          // FAILED and returns the money, so the instructor is never left short.
          const dispatched = await dispatchPayout(result.payoutId);
          if (!dispatched.ok) {
            throw new ORPCError("BAD_REQUEST", {
              message: dispatched.message ?? "Could not send the transfer. Your balance is unchanged.",
            });
          }
          return {
            status: "SENT" as const,
            netKobo: result.netKobo,
            feeKobo: result.feeKobo,
            message: "Withdrawal sent. Most banks credit within minutes.",
          };
        }

        const [me] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, context.user.id));

        await notifyPayoutQueued({
          instructorName: me?.name ?? "An instructor",
          amountKobo: input.amountKobo,
          payoutId: result.payoutId,
        });

        return {
          status: "QUEUED" as const,
          netKobo: result.netKobo,
          feeKobo: result.feeKobo,
          message: "Withdrawal submitted. It's above the automatic limit, so an admin will review it shortly.",
        };
      }),

    /** Past withdrawals for this instructor. */
    history: instructorProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional().default(20) }).optional())
      .handler(async ({ input, context }) => {
        return await db
          .select({
            id: payoutsTable.id,
            amountKobo: payoutsTable.amountKobo,
            feeKobo: payoutsTable.feeKobo,
            netKobo: payoutsTable.netKobo,
            status: payoutsTable.status,
            reference: payoutsTable.reference,
            bankName: payoutsTable.bankName,
            accountNumberMasked: payoutsTable.accountNumberMasked,
            failureReason: payoutsTable.failureReason,
            requestedAt: payoutsTable.requestedAt,
            completedAt: payoutsTable.completedAt,
          })
          .from(payoutsTable)
          .where(eq(payoutsTable.instructorId, context.user.id))
          .orderBy(desc(payoutsTable.requestedAt))
          .limit(input?.limit ?? 20);
      }),

    /** Earnings ledger for this instructor. */
    ledger: instructorProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional().default(30) }).optional())
      .handler(async ({ input, context }) => {
        return await getLedger(context.user.id, input?.limit ?? 30);
      }),

    // ── ADMIN ────────────────────────────────────────────────────────────────
    /** Payout queue. Defaults to the ones actually needing a decision. */
    adminList: adminProcedure
      .input(
        z
          .object({
            status: z
              .enum(["REQUESTED", "PROCESSING", "SUCCESS", "FAILED", "REVERSED", "CANCELLED", "ALL"])
              .optional()
              .default("REQUESTED"),
            limit: z.number().min(1).max(100).optional().default(50),
          })
          .optional(),
      )
      .handler(async ({ input }) => {
        const status = input?.status ?? "REQUESTED";
        const rows = await db
          .select({
            id: payoutsTable.id,
            instructorId: payoutsTable.instructorId,
            instructorName: users.name,
            instructorEmail: users.email,
            amountKobo: payoutsTable.amountKobo,
            feeKobo: payoutsTable.feeKobo,
            netKobo: payoutsTable.netKobo,
            status: payoutsTable.status,
            reference: payoutsTable.reference,
            bankName: payoutsTable.bankName,
            accountNumberMasked: payoutsTable.accountNumberMasked,
            accountName: payoutsTable.accountName,
            failureReason: payoutsTable.failureReason,
            requestedAt: payoutsTable.requestedAt,
            completedAt: payoutsTable.completedAt,
          })
          .from(payoutsTable)
          .leftJoin(users, eq(users.id, payoutsTable.instructorId))
          .where(status === "ALL" ? undefined : eq(payoutsTable.status, status))
          .orderBy(desc(payoutsTable.requestedAt))
          .limit(input?.limit ?? 50);

        const [pendingCount] = await db
          .select({ value: count() })
          .from(payoutsTable)
          .where(eq(payoutsTable.status, "REQUESTED"));

        return { rows, pendingCount: pendingCount?.value ?? 0 };
      }),

    /** Approve a queued payout and send it to Paystack. */
    adminApprove: adminProcedure
      .input(z.object({ payoutId: z.string() }))
      .handler(async ({ input, context }) => {
        const [payout] = await db
          .select()
          .from(payoutsTable)
          .where(eq(payoutsTable.id, input.payoutId));

        if (!payout) throw new ORPCError("NOT_FOUND", { message: "Payout not found." });
        if (payout.status !== "REQUESTED") {
          throw new ORPCError("BAD_REQUEST", {
            message: `This payout is already ${payout.status.toLowerCase()}.`,
          });
        }

        await db
          .update(payoutsTable)
          .set({ approvedBy: context.user.id })
          .where(eq(payoutsTable.id, input.payoutId));

        const dispatched = await dispatchPayout(input.payoutId);
        if (!dispatched.ok) {
          throw new ORPCError("BAD_REQUEST", {
            message: dispatched.message ?? "Could not send the transfer.",
          });
        }
        return { success: true };
      }),

    /** Reject a queued payout — returns the reserved money to the instructor. */
    adminReject: adminProcedure
      .input(z.object({ payoutId: z.string(), reason: z.string().min(3).max(300) }))
      .handler(async ({ input, context }) => {
        const [payout] = await db
          .select()
          .from(payoutsTable)
          .where(eq(payoutsTable.id, input.payoutId));

        if (!payout) throw new ORPCError("NOT_FOUND", { message: "Payout not found." });
        if (payout.status !== "REQUESTED") {
          throw new ORPCError("BAD_REQUEST", {
            message: `This payout is already ${payout.status.toLowerCase()}.`,
          });
        }

        // settlePayout with FAILED returns the reserved balance to available.
        await settlePayout({
          payoutId: input.payoutId,
          outcome: "FAILED",
          failureReason: `Rejected by admin: ${input.reason}`,
        });
        await db
          .update(payoutsTable)
          .set({ status: "CANCELLED", approvedBy: context.user.id })
          .where(eq(payoutsTable.id, input.payoutId));

        await notify({
          recipientId: payout.instructorId,
          type: "PAYOUT_FAILED",
          title: "Your withdrawal was declined",
          body: `${input.reason} — the money has been returned to your available balance.`,
          link: "/instructor/withdraw",
          entityType: "payout",
          entityId: input.payoutId,
        });

        return { success: true };
      }),

    /** Bank accounts held for review because the name didn't match. */
    adminBankReviews: adminProcedure.handler(async () => {
      return await db
        .select({
          instructorId: instructorPayoutAccounts.instructorId,
          instructorName: users.name,
          instructorEmail: users.email,
          bankName: instructorPayoutAccounts.bankName,
          accountName: instructorPayoutAccounts.accountName,
          accountNumber: instructorPayoutAccounts.accountNumber,
          nameMatchScore: instructorPayoutAccounts.nameMatchScore,
          createdAt: instructorPayoutAccounts.createdAt,
        })
        .from(instructorPayoutAccounts)
        .leftJoin(users, eq(users.id, instructorPayoutAccounts.instructorId))
        .where(sql`${instructorPayoutAccounts.verifiedAt} IS NULL`)
        .orderBy(desc(instructorPayoutAccounts.createdAt));
    }),

    /** Approve a bank account whose name match was weak, and create the recipient. */
    adminApproveBank: adminProcedure
      .input(z.object({ instructorId: z.string() }))
      .handler(async ({ input, context }) => {
        const [account] = await db
          .select()
          .from(instructorPayoutAccounts)
          .where(eq(instructorPayoutAccounts.instructorId, input.instructorId));

        if (!account) throw new ORPCError("NOT_FOUND", { message: "No bank account found." });

        const recipient = await createTransferRecipient({
          name: account.accountName,
          accountNumber: account.accountNumber,
          bankCode: account.bankCode,
        });
        if (!recipient.ok) {
          throw new ORPCError("BAD_REQUEST", { message: recipient.message });
        }

        await db
          .update(instructorPayoutAccounts)
          .set({
            recipientCode: recipient.recipientCode,
            verifiedAt: new Date(),
            manuallyApproved: true,
            approvedBy: context.user.id,
            updatedAt: new Date(),
          })
          .where(eq(instructorPayoutAccounts.instructorId, input.instructorId));

        return { success: true };
      }),

    /** Clear a PIN lockout for an instructor who locked themselves out. */
    adminClearPinLock: adminProcedure
      .input(z.object({ instructorId: z.string() }))
      .handler(async ({ input }) => {
        await clearPinLockout(input.instructorId);
        return { success: true };
      }),

    /**
     * Reverse an instructor's earnings for a refunded / charged-back purchase.
     *
     * Marks the transaction refunded and claws back every line item's credit. Anything the
     * instructor already withdrew is recorded as an unrecovered shortfall in the ledger
     * rather than being silently written off.
     */
    adminRefundTransaction: adminProcedure
      .input(z.object({ transactionId: z.string(), reason: z.string().min(3).max(300) }))
      .handler(async ({ input }) => {
        const [txn] = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, input.transactionId));

        if (!txn) throw new ORPCError("NOT_FOUND", { message: "Transaction not found." });
        if (txn.status !== "success") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only successful transactions can be refunded.",
          });
        }

        const items = await db
          .select({ id: transactionItems.id, instructorId: transactionItems.instructorId })
          .from(transactionItems)
          .where(eq(transactionItems.transactionId, input.transactionId));

        let totalShortfall = 0;
        const affected = new Set<string>();
        for (const item of items) {
          const res = await reverseSale({
            transactionItemId: item.id,
            reason: input.reason,
          });
          if (res.reversed) {
            totalShortfall += res.shortfallKobo;
            affected.add(item.instructorId);
          }
        }

        // Revoke access to the refunded courses.
        if (txn.courseIds.length > 0) {
          await db
            .delete(enrollments)
            .where(
              and(
                eq(enrollments.userId, txn.userId),
                inArray(enrollments.courseId, txn.courseIds),
              ),
            );
        }

        await db
          .update(transactions)
          .set({ status: "failed" })
          .where(eq(transactions.id, input.transactionId));

        for (const instructorId of affected) {
          await notify({
            recipientId: instructorId,
            type: "PAYOUT_FAILED",
            title: "A sale was refunded",
            body: `${input.reason} — the earnings for that sale have been reversed from your balance.`,
            link: "/instructor/revenue",
            entityType: "transaction",
            entityId: input.transactionId,
          });
        }

        return {
          success: true,
          itemsReversed: items.length,
          unrecoveredKobo: totalShortfall,
        };
      }),
  }),

  // --- NOTIFICATIONS (any signed-in user; rows are always scoped to the recipient) ---
  notifications: pub.router({
    list: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(50).optional().default(15),
            unreadOnly: z.boolean().optional().default(false),
          })
          .optional(),
      )
      .handler(async ({ input, context }) => {
        const limit = input?.limit ?? 15;
        const conditions = [eq(notifications.recipientId, context.user.id)];
        if (input?.unreadOnly) conditions.push(sql`${notifications.readAt} IS NULL`);

        return await db
          .select({
            id: notifications.id,
            type: notifications.type,
            title: notifications.title,
            body: notifications.body,
            link: notifications.link,
            readAt: notifications.readAt,
            createdAt: notifications.createdAt,
            actorName: users.name,
            actorImage: users.image,
          })
          .from(notifications)
          .leftJoin(users, eq(users.id, notifications.actorId))
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit);
      }),

    unreadCount: protectedProcedure.handler(async ({ context }) => {
      const [row] = await db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientId, context.user.id),
            sql`${notifications.readAt} IS NULL`,
          ),
        );
      return { count: row?.value ?? 0 };
    }),

    markRead: protectedProcedure
      .input(z.object({ id: z.string() }))
      .handler(async ({ input, context }) => {
        // Scoped by recipientId as well as id — a user must not be able to mark
        // someone else's notification read by guessing an id.
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(notifications.id, input.id),
              eq(notifications.recipientId, context.user.id),
            ),
          );
        return { success: true };
      }),

    markAllRead: protectedProcedure.handler(async ({ context }) => {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.recipientId, context.user.id),
            sql`${notifications.readAt} IS NULL`,
          ),
        );
      return { success: true };
    }),
  }),

  // --- STUDENT DOMAIN ---
  student: pub.router({
    getProfile: protectedProcedure.handler(({ context }) => {
      return { id: context.user.id, role: context.user.role };
    }),

    // --- INSTRUCTOR APPLICATION ---
    // Current application state, used to decide what /become-instructor renders.
    getInstructorApplication: protectedProcedure.handler(async ({ context }) => {
      const [row] = await db
        .select({
          role: users.role,
          status: users.instructorRequestStatus,
          title: users.title,
          aboutMe: users.aboutMe,
        })
        .from(users)
        .where(eq(users.id, context.user.id));

      if (!row) throw new ORPCError("NOT_FOUND", { message: "Account not found." });
      return row;
    }),

    // Submit (or re-submit after a rejection) an application to teach.
    requestInstructor: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120),
          aboutMe: z.string().trim().min(50, "Please write at least 50 characters.").max(2000),
        }),
      )
      .handler(async ({ input, context }) => {
        const [current] = await db
          .select({
            role: users.role,
            status: users.instructorRequestStatus,
          })
          .from(users)
          .where(eq(users.id, context.user.id));

        if (!current) throw new ORPCError("NOT_FOUND", { message: "Account not found." });

        if (current.role === "INSTRUCTOR" || current.role === "ADMIN") {
          throw new ORPCError("BAD_REQUEST", {
            message: "You already have teaching access.",
          });
        }

        if (current.status === "PENDING") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Your application is already under review.",
          });
        }

        // IDLE (first time) and REJECTED (re-apply) are both allowed through.
        await db
          .update(users)
          .set({
            title: input.title,
            aboutMe: input.aboutMe,
            instructorRequestStatus: "PENDING",
            updatedAt: new Date(),
          })
          .where(eq(users.id, context.user.id));

        const [applicant] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, context.user.id));

        await notifyAdmins({
          type: "INSTRUCTOR_APPLICATION",
          title: "New instructor application",
          body: `${applicant?.name || applicant?.email || "A user"} applied to teach — ${input.title}`,
          link: "/admin/instructor-requests",
          entityType: "user",
          entityId: context.user.id,
          actorId: context.user.id,
        });

        return { success: true, status: "PENDING" as const };
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
        if (!quiz) throw new ORPCError("NOT_FOUND", { message: "Quiz not found." });

        const [enrollment] = await db
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, quiz.courseId)));
        if (!enrollment) throw new ORPCError("FORBIDDEN", { message: "Not enrolled in this course." });

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
          throw new ORPCError("FORBIDDEN", { message: "You have used all 3 attempts for this quiz." });
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

        if (!enrollment) {
          throw new ORPCError("FORBIDDEN", {
            message: "You must be enrolled to submit a review.",
          });
        }

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

        // Tell the instructor. Side effect only — notify() never throws.
        const [course] = await db
          .select({ title: courses.title, instructorId: courses.instructorId })
          .from(courses)
          .where(eq(courses.id, input.courseId));

        if (course) {
          const [reviewer] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, context.user.id));

          await notify({
            recipientId: course.instructorId,
            type: "COURSE_REVIEWED",
            title: `New ${input.rating}-star review on "${course.title}"`,
            body: input.comment?.trim()
              ? `${reviewer?.name || "A student"}: "${input.comment.trim().slice(0, 140)}"`
              : `${reviewer?.name || "A student"} rated your course ${input.rating}/5.`,
            link: `/instructor/reviews/${input.courseId}`,
            entityType: "course",
            entityId: input.courseId,
            actorId: context.user.id,
          });
        }

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
          .select({ id: courses.id, title: courses.title, price: courses.price, discountPrice: courses.discountPrice, status: courses.status, instructorId: courses.instructorId })
          .from(courses)
          .where(inArray(courses.id, input.courseIds));

        if (courseList.length === 0) throw new ORPCError("BAD_REQUEST", { message: "No valid courses found." });

        // 2. Only PUBLISHED courses
        const unpublished = courseList.filter((c) => c.status !== "PUBLISHED");
        if (unpublished.length > 0) {
          const titles = unpublished.map((c) => `"${c.title}"`).join(", ");
          throw new ORPCError("BAD_REQUEST", { message: `${unpublished.length > 1 ? "Some courses are" : `${titles} is`} not available for purchase. Please remove it from your cart.` });
        }

        // 3. Check for already-enrolled courses
        const existingEnrollments = await db
          .select({ courseId: enrollments.courseId })
          .from(enrollments)
          .where(and(eq(enrollments.userId, userId), inArray(enrollments.courseId, input.courseIds)));

        const alreadyEnrolledIds = new Set(existingEnrollments.map((e) => e.courseId));
        const purchasableCourses = courseList.filter((c) => !alreadyEnrolledIds.has(c.id));

        if (purchasableCourses.length === 0) throw new ORPCError("BAD_REQUEST", { message: "You are already enrolled in all selected courses." });

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
        const [insertedTxn] = await db.insert(transactions).values({
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
        }).returning({ id: transactions.id });

        // 11. Per-course line items — this is what makes revenue attributable to an
        // instructor. Written now (while pending) and only counted as revenue once the
        // parent transaction reaches status='success'. instructorId is snapshotted so
        // reassigning a course later cannot rewrite historical earnings.
        if (insertedTxn) {
          await db.insert(transactionItems).values(
            paidCourses.map((c) => {
              const unitPriceKobo = nairaToKobo(effectivePriceNaira(c));
              const split = splitLine(unitPriceKobo);
              return {
                transactionId: insertedTxn.id,
                courseId: c.id,
                instructorId: c.instructorId,
                unitPriceKobo: split.unitPriceKobo,
                platformFeeKobo: split.platformFeeKobo,
                instructorEarningKobo: split.instructorEarningKobo,
              };
            }),
          );
        }

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

        if (!txn) throw new ORPCError("NOT_FOUND", { message: "Transaction not found." });
        if (txn.status === "success") return { alreadyProcessed: true, enrolled: txn.courseIds };
        if (txn.status === "failed") throw new ORPCError("BAD_REQUEST", { message: "This transaction failed. Please try again." });

        // 2. Verify with Paystack API
        const result = await verifyTransaction(input.reference);

        if (result.status !== "success") {
          await db.update(transactions).set({ status: "failed" }).where(eq(transactions.id, txn.id));
          await notifyPaymentFailed(txn.id, userId, txn.amount, `Paystack reported "${result.status}".`);
          throw new ORPCError("BAD_REQUEST", { message: "Payment was not successful. Please try again." });
        }

        // 3. Verify amount matches — prevent amount tampering
        if (result.amountKobo !== txn.amount) {
          await db.update(transactions).set({ status: "failed" }).where(eq(transactions.id, txn.id));
          await notifyPaymentFailed(
            txn.id,
            userId,
            txn.amount,
            `Amount mismatch — expected ${txn.amount} kobo, Paystack reported ${result.amountKobo}.`,
          );
          throw new ORPCError("BAD_REQUEST", { message: "Payment amount mismatch. Contact support." });
        }

        // 4. Enroll student in all paid courses
        await db.insert(enrollments).values(
          txn.courseIds.map((courseId) => ({ userId, courseId, accessType: "PURCHASE" as const }))
        ).onConflictDoNothing();

        // 5. Mark transaction success.
        // Conditional so this is an atomic pending → success transition: the Paystack
        // webhook races this call, and only the winner gets a row back and notifies.
        const flipped = await db.update(transactions)
          .set({ status: "success", verifiedAt: new Date() })
          .where(and(eq(transactions.id, txn.id), ne(transactions.status, "success")))
          .returning({ id: transactions.id });

        if (flipped.length > 0) {
          // 6. Credit the instructors' ledgers. Idempotent, so the webhook racing this
          // cannot double-credit. The webhook may never fire at all (it needs a public
          // URL), so this path must do it too.
          await creditTransaction(txn.id);

          // 7. Notify admins + the affected instructors. Side effect only — never throws.
          await notifyPurchaseSucceeded(txn.id, userId, txn.amount);
        }

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

        if (!enrollment) throw new ORPCError("FORBIDDEN", { message: "You are not enrolled in this course." });

        const [course] = await db
          .select({ id: courses.id, title: courses.title, thumbnailUrl: courses.thumbnailUrl })
          .from(courses)
          .where(eq(courses.id, input.courseId));

        if (!course) throw new ORPCError("NOT_FOUND", { message: "Course not found." });

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
