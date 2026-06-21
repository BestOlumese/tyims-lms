import { pgTable, text, timestamp, integer, pgEnum, real, boolean, uniqueIndex, AnyPgColumn, jsonb } from "drizzle-orm/pg-core";
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