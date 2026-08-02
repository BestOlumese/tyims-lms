import { pgTable, text, timestamp, integer, pgEnum, real, boolean, uniqueIndex, index, AnyPgColumn, jsonb } from "drizzle-orm/pg-core";
import { sql, relations, and, eq, or } from "drizzle-orm";

// --- ENUMS ---
export const roleEnum = pgEnum("role", ["STUDENT", "INSTRUCTOR", "ADMIN"]);
export const instructorStatusEnum = pgEnum("instructor_status", ["IDLE", "PENDING", "APPROVED", "REJECTED"]);
export const courseStatusEnum = pgEnum("course_status", ["DRAFT", "PROCESSING", "PUBLISHED", "ARCHIVED"]);
export const accessTypeEnum = pgEnum("access_type", ["PURCHASE", "SUBSCRIPTION", "GRANTED"]);
export const curriculumItemTypeEnum = pgEnum("curriculum_item_type", ["VIDEO", "QUIZ", "FILE"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "success", "failed"]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").default("STUDENT").notNull(),
  password: text("password"),
  
  // --- PAYSTACK INTEGRATION ---
  paystackCustomerCode: text("paystack_customer_code"),     
  paystackSubaccountCode: text("paystack_subaccount_code"), 
  
  // --- STATUS & WORKFLOW ---
  isBlocked: boolean("is_blocked").default(false).notNull(),
  instructorRequestStatus: instructorStatusEnum("instructor_request_status").default("IDLE").notNull(),
  
  // --- INSTRUCTOR PROFILE FIELDS ---
  title: text("title"),
  aboutMe: text("about_me"),
  phone: text("phone"),
  website: text("website"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  xUrl: text("x_url"),
  linkedinUrl: text("linkedin_url"),

  // --- WITHDRAWAL SECURITY ---
  // 6-digit transaction PIN, hashed with the same algorithm as passwords.
  // NEVER store or log the plaintext PIN.
  transactionPinHash: text("transaction_pin_hash"),
  transactionPinSetAt: timestamp("transaction_pin_set_at"),
  /** Consecutive wrong attempts. Reset to 0 on success. */
  pinFailedAttempts: integer("pin_failed_attempts").notNull().default(0),
  /** Set when attempts hit the limit; withdrawals refused until it passes. */
  pinLockedUntil: timestamp("pin_locked_until"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- CORE DOMAIN ---
export const categories = pgTable("category", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), 
  // The Self-Reference for Subcategories
  parentId: text("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "cascade" }),
});

export const courses = pgTable("course", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  instructorId: text("instructor_id").notNull().references(() => users.id),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  
  // Advanced Fields
  whatYouWillLearn: text("what_you_will_learn").array(), // Array of strings
  requirements: text("requirements").array(),         // Array of strings
  inclusions: text("inclusions").array(),             // Array of strings
  
  price: real("price").notNull().default(0), 
  discountPrice: real("discount_price"),
  
  status: courseStatusEnum("status").default("DRAFT").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chapters = pgTable("chapter", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lessons = pgTable("lesson", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: text("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: curriculumItemTypeEnum("type").default("VIDEO").notNull(),
  orderIndex: integer("order_index").notNull(),
  
  // Video specific (Mux)
  muxUploadId: text("mux_upload_id"),
  muxAssetId: text("mux_asset_id"),
  muxPlaybackId: text("mux_playback_id"),
  durationSeconds: real("duration_seconds").default(0),
  
  // File specific
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  
  // Quiz reference
  quizId: text("quiz_id").references((): AnyPgColumn => quizzes.id, { onDelete: "set null" }),
  
  isFree: boolean("is_free").default(false).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizzes = pgTable("quiz", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").default(70).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizQuestions = pgTable("quiz_question", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: text("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  type: text("type").default("MULTIPLE_CHOICE").notNull(), // MULTIPLE_CHOICE, TRUE_FALSE
  orderIndex: integer("order_index").notNull(),
});

export const quizOptions = pgTable("quiz_option", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: text("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").default(false).notNull(),
});

export const quizSubmissions = pgTable("quiz_submission", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  quizId: text("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  score: real("score").notNull(),
  isPassed: boolean("is_passed").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizSubmissionAnswers = pgTable("quiz_submission_answer", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: text("submission_id").notNull().references(() => quizSubmissions.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  selectedOptionId: text("selected_option_id").notNull().references(() => quizOptions.id, { onDelete: "cascade" }),
  isCorrect: boolean("is_correct").notNull(),
});

export const attachments = pgTable("attachment", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("review", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("user_course_review_idx").on(table.userId, table.courseId),
]);

// --- TRACKING & COMMERCE ---
export const enrollments = pgTable("enrollment", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  accessType: accessTypeEnum("access_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("user_course_idx").on(table.userId, table.courseId),
]);

export const videoProgress = pgTable("video_progress", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  secondsWatched: real("seconds_watched").default(0).notNull(),
  isCompleted: boolean("is_completed").default(false),
  lastWatchedAt: timestamp("last_watched_at").defaultNow(),
}, (table) => [
  uniqueIndex("user_lesson_idx").on(table.userId, table.lessonId),
]);

export const transactions = pgTable("transaction", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => users.id),
  // Snapshot of purchased course IDs
  courseIds: text("course_ids").array().notNull(),
  // Amounts stored in kobo (NGN × 100)
  amount: integer("amount").notNull(),
  serviceFee: integer("service_fee").notNull().default(0),
  paystackReference: text("paystack_reference").notNull().unique(),
  paystackAccessCode: text("paystack_access_code"),
  status: transactionStatusEnum("status").notNull().default("pending"),
  // Snapshot of course titles/prices at purchase time for audit
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

/**
 * Per-course line items for a transaction.
 *
 * `transactions` stores only `courseIds text[]` and one combined `amount`, so a purchase
 * spanning two instructors cannot be attributed to either. This table makes revenue
 * answerable per course and per instructor.
 *
 * `instructorId` is snapshotted at purchase time on purpose: joining to
 * `course.instructor_id` at query time would rewrite historical earnings if a course is
 * ever reassigned.
 *
 * All amounts in kobo (integers). Rows are written at checkout and only counted as
 * revenue once the parent transaction reaches `status = 'success'`.
 */
export const transactionItems = pgTable("transaction_item", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => users.id),
  /** Price actually charged for this course (discountPrice if it was set). */
  unitPriceKobo: integer("unit_price_kobo").notNull(),
  /** The platform's commission on this line. */
  platformFeeKobo: integer("platform_fee_kobo").notNull().default(0),
  /** unitPriceKobo − platformFeeKobo. Stored so past earnings never move. */
  instructorEarningKobo: integer("instructor_earning_kobo").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("txn_item_instructor_idx").on(table.instructorId),
  index("txn_item_course_idx").on(table.courseId),
  index("txn_item_txn_idx").on(table.transactionId),
]);

// --- NOTIFICATIONS ---
export const notificationTypeEnum = pgEnum("notification_type", [
  // → admin
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "INSTRUCTOR_APPLICATION",
  // → instructor
  "COURSE_PURCHASED",
  "COURSE_REVIEWED",
  // → applicant
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  // → payouts
  "PAYOUT_QUEUED", // admins: a withdrawal needs approval
  "PAYOUT_SENT", // instructor: money is on its way
  "PAYOUT_FAILED", // instructor: it didn't go through, funds returned
  "BANK_ACCOUNT_REVIEW", // admins: bank account name mismatch needs a human
]);

export const notifications = pgTable("notification", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  /** Who sees this. */
  recipientId: text("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  /** Where clicking it should go, e.g. /admin/instructor-requests */
  link: text("link"),
  /** What it is about, for de-duplication and deep links. */
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  /** Who caused it (buyer, applicant, reviewer). Null for system events. */
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  /** Null = unread. */
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Drives both the unread badge and the inbox list.
  index("notification_recipient_idx").on(table.recipientId, table.readAt),
  index("notification_created_idx").on(table.createdAt),
]);

// ═══════════════════════════════════════════════════════════════════════════
// PAYOUTS
//
// Money model: the platform receives every payment, credits the instructor's share to an
// append-only ledger, and sends money out on request via Paystack Transfers.
//
// Invariants this schema exists to protect:
//   · all amounts are integer kobo — never a float
//   · `ledgerEntries` is append-only; corrections are new rows, never edits
//   · `instructorBalances` is materialised, and is the ONLY thing a withdrawal checks,
//     under a row lock, so two concurrent withdrawals can't both pass
//   · `payouts.reference` is unique — our idempotency key against Paystack
// ═══════════════════════════════════════════════════════════════════════════

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "SALE", // + instructor's share of a completed purchase
  "PAYOUT", // − money sent to their bank
  "PAYOUT_FEE", // − transfer fee + stamp duty, deducted from the instructor
  "PAYOUT_REVERSAL", // + a failed/reversed transfer coming back
  "REFUND", // − buyer refunded after the sale was credited
  "ADJUSTMENT", // ± manual correction by an admin
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "REQUESTED", // awaiting admin approval (above the auto-approve threshold)
  "PROCESSING", // sent to Paystack, waiting on the webhook
  "SUCCESS", // transfer.success received
  "FAILED", // transfer.failed received
  "REVERSED", // transfer.reversed received
  "CANCELLED", // withdrawn by the instructor or rejected by an admin
]);

/** Where an instructor's money goes. One per instructor. */
export const instructorPayoutAccounts = pgTable("instructor_payout_account", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  instructorId: text("instructor_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  bankCode: text("bank_code").notNull(),
  bankName: text("bank_name").notNull(),
  /** Nigerian NUBAN, 10 digits. Stored as text — it is an identifier, not a number. */
  accountNumber: text("account_number").notNull(),
  /** The real account holder, as returned by Paystack /bank/resolve. Never user-supplied. */
  accountName: text("account_name").notNull(),
  /** 0..1 similarity between accountName and the instructor's profile name. */
  nameMatchScore: real("name_match_score").notNull().default(0),
  /** Paystack recipient_code from POST /transferrecipient. */
  recipientCode: text("recipient_code"),
  /** Set once the account resolves AND the name check passes (or an admin overrides). */
  verifiedAt: timestamp("verified_at"),
  /** True when a human approved despite a weak name match. */
  manuallyApproved: boolean("manually_approved").notNull().default(false),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Materialised balance. Derived from `ledgerEntries`, but stored so a withdrawal can lock
 * exactly one row (`SELECT … FOR UPDATE`) instead of re-aggregating the whole ledger.
 */
export const instructorBalances = pgTable("instructor_balance", {
  instructorId: text("instructor_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Past the hold period and not yet withdrawn — the only withdrawable figure. */
  availableKobo: integer("available_kobo").notNull().default(0),
  /** Earned but still inside the hold window. */
  pendingKobo: integer("pending_kobo").notNull().default(0),
  /** Reserved by an in-flight payout: already debited from available, not yet paid. */
  reservedKobo: integer("reserved_kobo").notNull().default(0),
  /** Lifetime successfully paid out. */
  withdrawnKobo: integer("withdrawn_kobo").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Append-only. Never UPDATE, never DELETE — this is the audit trail. */
export const ledgerEntries = pgTable("ledger_entry", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: ledgerEntryTypeEnum("type").notNull(),
  /** Signed: positive credits the instructor, negative debits them. */
  amountKobo: integer("amount_kobo").notNull(),
  /** Running total after this entry, so the ledger can be audited without replaying it. */
  balanceAfterKobo: integer("balance_after_kobo").notNull(),
  /** When a SALE credit becomes withdrawable. Null for non-SALE entries. */
  availableAt: timestamp("available_at"),
  transactionItemId: text("transaction_item_id").references(() => transactionItems.id, {
    onDelete: "set null",
  }),
  payoutId: text("payout_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ledger_instructor_idx").on(table.instructorId, table.createdAt),
  index("ledger_available_idx").on(table.availableAt),
  // One SALE credit per line item, enforced by the database rather than by hope.
  uniqueIndex("ledger_txn_item_unique_idx").on(table.transactionItemId),
]);

/** One withdrawal request and its lifecycle. */
export const payouts = pgTable("payout", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  instructorId: text("instructor_id")
    .notNull()
    .references(() => users.id),
  /** Gross requested by the instructor. */
  amountKobo: integer("amount_kobo").notNull(),
  /** Transfer fee + stamp duty, deducted from the instructor. */
  feeKobo: integer("fee_kobo").notNull().default(0),
  /** amountKobo − feeKobo — what actually lands in their bank. */
  netKobo: integer("net_kobo").notNull(),
  status: payoutStatusEnum("status").notNull().default("REQUESTED"),
  /** OUR idempotency key, sent to Paystack as `reference`. Unique by construction. */
  reference: text("reference").notNull().unique(),
  /** Snapshot of the destination, so history stays truthful if bank details change later. */
  bankName: text("bank_name").notNull(),
  accountNumberMasked: text("account_number_masked").notNull(),
  accountName: text("account_name").notNull(),
  paystackTransferCode: text("paystack_transfer_code"),
  failureReason: text("failure_reason"),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("payout_instructor_idx").on(table.instructorId, table.requestedAt),
  index("payout_status_idx").on(table.status),
]);

export const payoutRelations = relations(payouts, ({ one }) => ({
  instructor: one(users, {
    fields: [payouts.instructorId],
    references: [users.id],
  }),
}));

export const transactionItemRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  course: one(courses, {
    fields: [transactionItems.courseId],
    references: [courses.id],
  }),
  instructor: one(users, {
    fields: [transactionItems.instructorId],
    references: [users.id],
  }),
}));

export const courseRelations = relations(courses, ({ many }) => ({
  chapters: many(chapters),
  attachments: many(attachments),
  reviews: many(reviews),
  enrollments: many(enrollments),
}));

export const chapterRelations = relations(chapters, ({ one, many }) => ({
  course: one(courses, {
    fields: [chapters.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}));

export const lessonRelations = relations(lessons, ({ one }) => ({
  chapter: one(chapters, {
    fields: [lessons.chapterId],
    references: [chapters.id],
  }),
}));