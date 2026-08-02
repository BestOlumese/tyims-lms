"use client";

import React from "react";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/formatPrice";

function StarRating({ rating }) {
  const filled = Math.round(rating);
  const empty = 5 - filled;
  return (
    <>
      {Array.from({ length: filled }).map((_, i) => (
        <i key={i} className="icon-star-1" />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <svg key={i} width={12} height={11} viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.54831 7.10382L3.58894 6.85477L3.41273 6.67416L1.16841 4.37373L4.24914 3.90314L4.51288 3.86286L4.62625 3.62134L5.99989 0.694982L7.37398 3.62182L7.48735 3.86332L7.75108 3.9036L10.8318 4.37419L8.58749 6.67462L8.41128 6.85523L8.4519 7.10428L8.98079 10.3465L6.24201 8.8325L6.00014 8.69879L5.75826 8.83247L3.01941 10.3461L3.54831 7.10382Z" stroke="#131836" />
        </svg>
      ))}
    </>
  );
}


function CourseCard({ course, instructorName }) {
  const displayPrice = course.discountPrice > 0 ? course.discountPrice : course.price;
  const originalPrice = course.discountPrice > 0 ? course.price : null;
  const rating = course.avgRating ?? 0;
  const filledStars = Math.round(rating);
  const emptyStars = 5 - filledStars;

  return (
    <div className="course-item hover-img title-small">
      <div className="features image-wrap">
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
            <i className="flaticon-online-training" style={{ fontSize: 48, color: "#ccc" }} />
          </div>
        )}
      </div>
      <div className="content">
        <div className="meta">
          {course.lessonCount > 0 && (
            <div className="meta-item">
              <i className="flaticon-calendar" />
              <p>{course.lessonCount} Lessons</p>
            </div>
          )}
          {course.enrollmentCount > 0 && (
            <div className="meta-item">
              <i className="flaticon-user" />
              <p>{course.enrollmentCount} Students</p>
            </div>
          )}
        </div>
        <h6 className="fw-5 line-clamp-2">
          <Link href={`/courses/${course.id}`}>{course.title}</Link>
        </h6>
        <div className="ratings pb-30">
          <div className="number">{rating.toFixed(1)}</div>
          {Array.from({ length: filledStars }).map((_, i) => (
            <i key={i} className="icon-star-1" />
          ))}
          {Array.from({ length: emptyStars }).map((_, i) => (
            <svg key={i} width={12} height={11} viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.54831 7.10382L3.58894 6.85477L3.41273 6.67416L1.16841 4.37373L4.24914 3.90314L4.51288 3.86286L4.62625 3.62134L5.99989 0.694982L7.37398 3.62182L7.48735 3.86332L7.75108 3.9036L10.8318 4.37419L8.58749 6.67462L8.41128 6.85523L8.4519 7.10428L8.98079 10.3465L6.24201 8.8325L6.00014 8.69879L5.75826 8.83247L3.01941 10.3461L3.54831 7.10382Z" stroke="#131836" />
            </svg>
          ))}
          <div className="total">({course.reviewCount ?? 0})</div>
        </div>
        {instructorName && (
          <div className="author">
            By: <a href="#">{instructorName}</a>
          </div>
        )}
        <div className="bottom">
          <div className="h6 price fw-5">
            {formatPrice(displayPrice)}
            {originalPrice != null && (
              <span style={{ fontSize: 13, color: "#999", marginLeft: 8, textDecoration: "line-through" }}>
                {formatPrice(originalPrice)}
              </span>
            )}
          </div>
          <Link href={`/courses/${course.id}`} className="tf-btn-arrow">
            <span className="fw-5 fs-15">Enroll Course</span>
            <i className="icon-arrow-top-right" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function InstructorProfileClient({ id }) {
  const { data, isLoading } = useQuery(
    orpc.getPublicInstructor.queryOptions({ input: { id } }),
  );

  if (isLoading) {
    return (
      <>
        {/* Hero skeleton */}
        <div className="instructor-page-title page-title style-5">
          <div className="tf-container">
            <div className="row">
              <div className="col-lg-8">
                <div className="content">
                  <div style={{ height: 14, background: "rgba(255,255,255,0.2)", borderRadius: 4, width: "40%", marginBottom: 60 }} />
                  <div style={{ height: 36, background: "rgba(255,255,255,0.2)", borderRadius: 4, width: "60%", marginBottom: 16 }} />
                  <div style={{ height: 18, background: "rgba(255,255,255,0.2)", borderRadius: 4, width: "30%", marginBottom: 24 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="section-page-instructor-single">
          <div className="tf-container" style={{ padding: "40px 0", textAlign: "center", color: "#888" }}>
            Loading instructor...
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <div className="tf-container" style={{ padding: "80px 0", textAlign: "center" }}>
        <i className="flaticon-user" style={{ fontSize: 64, color: "#ccc" }} />
        <p style={{ marginTop: 16, color: "#888" }}>Instructor not found.</p>
        <Link href="/instructors" className="tf-btn" style={{ marginTop: 24, display: "inline-block" }}>
          Back to Instructors
        </Link>
      </div>
    );
  }

  const { instructor, courses } = data;
  const avgRating = instructor.avgRating ?? 0;

  return (
    <>
      {/* Hero */}
      <div className="instructor-page-title page-title style-5">
        <div className="tf-container">
          <div className="row">
            <div className="col-lg-8">
              <div className="content">
                <ul className="breadcrumbs flex items-center justify-start gap-10 mb-60">
                  <li>
                    <Link href="/" className="flex">
                      <i className="icon-home" />
                    </Link>
                  </li>
                  <li><i className="icon-arrow-right" /></li>
                  <li>
                    <Link href="/instructors">Instructors</Link>
                  </li>
                  <li><i className="icon-arrow-right" /></li>
                  <li>{instructor.name}</li>
                </ul>
                <h2 className="font-cardo fw-7">Hi, I Am {instructor.name}</h2>
                {instructor.title && (
                  <p className="except">{instructor.title}</p>
                )}
                <ul className="entry-meta mb-30">
                  <li>
                    <div className="ratings">
                      <div className="number">{avgRating.toFixed(1)}</div>
                      <StarRating rating={avgRating} />
                      <p className="total fs-15">
                        {instructor.reviewCount ?? 0} rating{(instructor.reviewCount ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </li>
                  <li>
                    <i className="flaticon-book fs-16" />
                    <p className="fs-15">{instructor.courseCount ?? 0} Courses</p>
                  </li>
                  <li>
                    <i className="flaticon-user fs-18" />
                    <p className="fs-15">{instructor.studentCount ?? 0} Students</p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="section-page-instructor-single">
        <div className="tf-container">
          <div className="row">
            {/* Left column */}
            <div className="col-lg-8">
              <div className="instructor-single-inner">
                {/* About */}
                {instructor.bio && (
                  <div className="instructor-about">
                    <h2 className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      About Me
                    </h2>
                    <div
                      className="text-1 fs-15"
                      dangerouslySetInnerHTML={{ __html: instructor.bio }}
                    />
                  </div>
                )}

                {/* Courses */}
                <div className="instructor-my-course">
                  <h2 className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                    My Courses ({courses.length})
                  </h2>
                  {courses.length === 0 ? (
                    <p style={{ color: "#888" }}>No published courses yet.</p>
                  ) : (
                    <div className="grid-list-items-3">
                      {courses.map((course) => (
                        <CourseCard key={course.id} course={course} instructorName={instructor.name} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-lg-4">
              <div className="sidebar-instructor">
                <div className="instructor-img">
                  {instructor.image ? (
                    <Image
                      alt={instructor.name || ""}
                      src={instructor.image}
                      width={520}
                      height={521}
                      style={{ width: "100%", height: "auto" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1/1",
                        background: "#E27447",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 80,
                        fontWeight: 700,
                        borderRadius: 8,
                      }}
                    >
                      {instructor.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                {(instructor.phone || instructor.website) && (
                  <div className="sidebar-instructor-content">
                    <h5 className="fw-5">Contact Me</h5>
                    <ul>
                      {instructor.phone && (
                        <li className="item-contact">
                          <i className="flaticon-call" />
                          <a href={`tel:${instructor.phone}`}>{instructor.phone}</a>
                        </li>
                      )}
                      {instructor.website && (
                        <li className="item-contact">
                          <i className="flaticon-programming" />
                          <a href={instructor.website} target="_blank" rel="noopener noreferrer">
                            {instructor.website.replace(/^https?:\/\//, "")}
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {(instructor.facebookUrl || instructor.instagramUrl || instructor.xUrl || instructor.linkedinUrl) && (
                  <div className="instructor-social">
                    <h6 className="fw-5">Follow me</h6>
                    <ul>
                      {instructor.facebookUrl && (
                        <li>
                          <a href={instructor.facebookUrl} target="_blank" rel="noopener noreferrer">
                            <i className="flaticon-facebook-1" />
                          </a>
                        </li>
                      )}
                      {instructor.xUrl && (
                        <li className="course-social-item">
                          <a href={instructor.xUrl} target="_blank" rel="noopener noreferrer">
                            <i className="icon-twitter" />
                          </a>
                        </li>
                      )}
                      {instructor.instagramUrl && (
                        <li className="course-social-item">
                          <a href={instructor.instagramUrl} target="_blank" rel="noopener noreferrer">
                            <i className="flaticon-instagram" />
                          </a>
                        </li>
                      )}
                      {instructor.linkedinUrl && (
                        <li className="course-social-item">
                          <a href={instructor.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <i className="flaticon-linkedin-1" />
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
