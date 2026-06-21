"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/formatPrice";
import StudentDashboardNav from "./StudentDashboardNav";

function CourseCard({ course }) {
  const displayPrice = course.discountPrice > 0 ? course.discountPrice : course.price;
  const rating = course.avgRating ?? 0;
  const filledStars = Math.round(rating);
  const emptyStars = 5 - filledStars;

  return (
    <div className="course-item hover-img wow fadeInUp">
      <div className="features image-wrap" style={{ height: 220 }}>
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#f4f4f4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="flaticon-online-learning" style={{ fontSize: 40, color: "#ccc" }} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "#E27447",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Enrolled
        </div>
      </div>
      <div className="content">
        <div className="meta">
          {course.lessonCount > 0 && (
            <div className="meta-item">
              <i className="flaticon-calendar" />
              <p>{course.lessonCount} Lesson{course.lessonCount !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
        <h6 className="fw-5 line-clamp-2">
          <Link href={`/courses/${course.courseId}/learn`}>{course.title}</Link>
        </h6>
        {rating > 0 && (
          <div className="ratings pb-10">
            <div className="number">{rating.toFixed(1)}</div>
            {Array.from({ length: filledStars }).map((_, i) => (
              <i key={i} className="icon-star-1" />
            ))}
            {Array.from({ length: emptyStars }).map((_, i) => (
              <svg
                key={i}
                width={12}
                height={11}
                viewBox="0 0 12 11"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.54831 7.10382L3.58894 6.85477L3.41273 6.67416L1.16841 4.37373L4.24914 3.90314L4.51288 3.86286L4.62625 3.62134L5.99989 0.694982L7.37398 3.62182L7.48735 3.86332L7.75108 3.9036L10.8318 4.37419L8.58749 6.67462L8.41128 6.85523L8.4519 7.10428L8.98079 10.3465L6.24201 8.8325L6.00014 8.69879L5.75826 8.83247L3.01941 10.3461L3.54831 7.10382Z"
                  stroke="#131836"
                />
              </svg>
            ))}
            <div className="total">({course.reviewCount ?? 0})</div>
          </div>
        )}
        {course.instructorName && (
          <div className="author" style={{ marginBottom: 12 }}>
            By: <span style={{ fontWeight: 600 }}>{course.instructorName}</span>
          </div>
        )}
        <div className="bottom">
          <div className="h6 price fw-5">
            {displayPrice === 0 ? "Free" : formatPrice(displayPrice)}
          </div>
          <Link href={`/courses/${course.courseId}/learn`} className="tf-btn-arrow">
            <span className="fw-5 fs-15">Continue</span>
            <i className="icon-arrow-top-right" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function StudentMyCoursesClient() {
  const { data: session } = authClient.useSession();
  const searchParams = useSearchParams();
  const justEnrolled = searchParams.get("enrolled") === "1";

  const { data: courses, isLoading } = useQuery(
    orpc.student.getEnrolledCourses.queryOptions(),
  );

  const user = session?.user;
  const initials = user?.name?.charAt(0)?.toUpperCase() || "S";

  return (
    <>
      {/* Hero banner */}
      <div className="page-title style-9 bg-5">
        <div className="tf-container">
          <div className="row items-center">
            <div className="col-lg-8">
              <div className="content">
                <div className="author-item">
                  <div
                    className="author-item-img"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {user?.image ? (
                      <img
                        src={user.image}
                        alt={user.name || ""}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "#E27447",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 32,
                          fontWeight: 700,
                        }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                </div>
                <div className="title">
                  <h2 className="font-cardo fw-7 mb-20">
                    Welcome, {user?.name || "Student"}
                  </h2>
                  <ul className="entry-meta mt-4 mb-4">
                    <li>
                      <i className="flaticon-book" />
                      {courses?.length ?? 0} Course{(courses?.length ?? 0) !== 1 ? "s" : ""} Enrolled
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="main-content pt-0">
        <div className="page-inner tf-spacing-1">
          <div className="tf-container">
            <div className="row">
              <StudentDashboardNav />

              {/* Main content */}
              <div className="col-xl-9 col-lg-12">
                <div className="section-my-courses-right section-right">
                  {justEnrolled && (
                    <div
                      style={{
                        background: "#f0fff4",
                        border: "1px solid #9ae6b4",
                        borderRadius: 8,
                        padding: "14px 18px",
                        color: "#276749",
                        fontSize: 15,
                        marginBottom: 24,
                      }}
                    >
                      Enrollment successful! Your courses are ready below.
                    </div>
                  )}

                  {isLoading ? (
                    <div className="row">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="col-xl-4 col-lg-6 col-12">
                          <div
                            className="course-item"
                            style={{ background: "#f9f9f9", borderRadius: 8, padding: 16 }}
                          >
                            <div
                              style={{
                                height: 220,
                                background: "#eee",
                                borderRadius: 6,
                                marginBottom: 12,
                              }}
                            />
                            <div
                              style={{
                                height: 14,
                                background: "#eee",
                                borderRadius: 4,
                                width: "70%",
                                marginBottom: 8,
                              }}
                            />
                            <div
                              style={{ height: 14, background: "#eee", borderRadius: 4, width: "50%" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !courses || courses.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 0", color: "#888" }}>
                      <i
                        className="flaticon-online-learning"
                        style={{ fontSize: 64, color: "#ccc", display: "block", marginBottom: 16 }}
                      />
                      <p style={{ fontSize: 17, marginBottom: 24 }}>
                        You haven&apos;t enrolled in any courses yet.
                      </p>
                      <Link href="/courses" className="tf-btn">
                        Browse Courses <i className="icon-arrow-top-right" />
                      </Link>
                    </div>
                  ) : (
                    <div className="row">
                      {courses.map((course) => (
                        <div key={course.courseId} className="col-xl-4 col-lg-6 col-12">
                          <CourseCard course={course} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
