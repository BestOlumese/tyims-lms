"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth/auth-client";
import { formatPrice, formatDuration } from "@/lib/formatPrice";
import Link from "next/link";
import Image from "next/image";
import MuxPlayer from "@mux/mux-player-react";
import { useCart } from "@/lib/cart-context";
import { useRouter } from "next/navigation";

const STAR_SVG = (
  <svg width={12} height={11} viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.54831 7.10382L3.58894 6.85477L3.41273 6.67416L1.16841 4.37373L4.24914 3.90314L4.51288 3.86286L4.62625 3.62134L5.99989 0.694982L7.37398 3.62182L7.48735 3.86332L7.75108 3.9036L10.8318 4.37419L8.58749 6.67462L8.41128 6.85523L8.4519 7.10428L8.98079 10.3465L6.24201 8.8325L6.00014 8.69879L5.75826 8.83247L3.01941 10.3461L3.54831 7.10382ZM11.0444 4.15626L11.0442 4.15651L11.0444 4.15626Z"
      stroke="#131836"
    />
  </svg>
);

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="ratings" style={{ cursor: "pointer", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={star <= (hovered || value) ? "icon-star-1" : "flaticon-star"}
          style={{ fontSize: 18, color: star <= (hovered || value) ? "#f4a60d" : "#ccc" }}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        />
      ))}
      {value > 0 && <span style={{ marginLeft: 8 }}>{value} / 5</span>}
    </div>
  );
}

function RelativeDate({ date }) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return <span>Today</span>;
  if (diffDays < 30) return <span>{diffDays} day{diffDays !== 1 ? "s" : ""} ago</span>;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return <span>{diffMonths} month{diffMonths !== 1 ? "s" : ""} ago</span>;
  const diffYears = Math.floor(diffMonths / 12);
  return <span>{diffYears} year{diffYears !== 1 ? "s" : ""} ago</span>;
}

function LessonIcon({ type }) {
  if (type === "QUIZ") return <i className="flaticon-question" />;
  if (type === "FILE") return <i className="flaticon-document" />;
  return <i className="flaticon-play-1" />;
}

function ReviewSkeleton() {
  return (
    <div className="review-item" style={{ alignItems: "flex-start" }}>
      <div className="avatar" style={{ alignSelf: "flex-start", overflow: "hidden" }}>
        <div className="skel-circle" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
      </div>
      <div className="comment-box" style={{ flex: 1 }}>
        <div className="skel-line" style={{ height: 14, width: "38%", marginBottom: 10, borderRadius: 4 }} />
        <div className="skel-line" style={{ height: 11, width: "25%", marginBottom: 14, borderRadius: 4 }} />
        <div className="skel-line" style={{ height: 11, width: "92%", marginBottom: 7, borderRadius: 4 }} />
        <div className="skel-line" style={{ height: 11, width: "74%", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function VideoModal({ lesson, allPreviews, onSelect, onClose }) {
  if (!lesson?.muxPlaybackId) return null;

  return (
    <>
      <style>{`
        .vm-overlay{position:fixed;inset:0;background:rgba(19,24,54,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);}
        .vm-box{background:#fff;border-radius:16px;overflow:hidden;width:100%;max-width:980px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(19,24,54,0.35);}
        .vm-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:#fff;border-bottom:1px solid #eef0f6;flex-shrink:0;}
        .vm-header-icon{width:34px;height:34px;border-radius:50%;background:rgba(226,116,71,0.12);display:flex;align-items:center;justify-content:center;}
        .vm-close{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid #e0e3ee;border-radius:8px;color:#555;font-size:13px;padding:7px 16px;cursor:pointer;font-family:inherit;font-weight:500;transition:all 0.15s;}
        .vm-close:hover{border-color:#E27447;color:#E27447;}
        .vm-body{display:flex;flex:1;overflow:hidden;min-height:0;}
        .vm-player{flex:1;display:flex;flex-direction:column;background:#000;min-width:0;}
        .vm-now-playing{padding:14px 18px;background:#fff;border-top:1px solid #eef0f6;border-bottom:1px solid #eef0f6;}
        .vm-playlist{width:284px;flex-shrink:0;background:#f8f9fc;border-left:1px solid #eef0f6;display:flex;flex-direction:column;overflow:hidden;}
        .vm-playlist-head{padding:14px 16px;border-bottom:1px solid #eef0f6;flex-shrink:0;background:#fff;}
        .vm-playlist-items{overflow-y:auto;flex:1;}
        .vm-pitem{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid #eef0f6;border-left:3px solid transparent;transition:background 0.15s,border-left-color 0.15s;}
        .vm-pitem:hover{background:#fdf3ef;}
        .vm-pitem.active{background:#fef0e8;border-left-color:#E27447;}
        .vm-pitem-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#e8e9f0;transition:background 0.15s;}
        .vm-pitem.active .vm-pitem-icon{background:#E27447;}
        .vm-pitem-title{font-size:13px;line-height:1.4;color:#666;transition:color 0.15s;}
        .vm-pitem.active .vm-pitem-title{color:#131836;font-weight:600;}
        .vm-pitem-num{font-size:11px;color:#aaa;margin-top:2px;}
        .vm-pitem.active .vm-pitem-num{color:#E27447;}
        @media(max-width:680px){.vm-body{flex-direction:column;}.vm-playlist{width:100%;max-height:190px;border-left:none;border-top:1px solid #eef0f6;}}
      `}</style>

      <div className="vm-overlay" onClick={onClose}>
        <div className="vm-box" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="vm-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="vm-header-icon">
                <i className="flaticon-play-1" style={{ fontSize: 13, color: "#E27447" }} />
              </div>
              <div>
                <span style={{ color: "#131836", fontWeight: 700, fontSize: 15 }}>Free Preview</span>
                <span style={{ color: "#999", fontSize: 13, marginLeft: 8 }}>
                  {allPreviews.length} lesson{allPreviews.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <button className="vm-close" onClick={onClose}>
              <i className="flaticon-close" style={{ fontSize: 10 }} />
              Close
            </button>
          </div>

          {/* Body */}
          <div className="vm-body">

            {/* Player column */}
            <div className="vm-player">
              <div style={{ lineHeight: 0, background: "#000" }}>
                <MuxPlayer
                  streamType="on-demand"
                  playbackId={lesson.muxPlaybackId}
                  accentColor="#E27447"
                  autoPlay
                  style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
                />
              </div>
              <div className="vm-now-playing">
                <p style={{ margin: "0 0 3px", fontSize: 11, color: "#E27447", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Now Playing
                </p>
                <h6 style={{ margin: 0, color: "#131836", fontSize: 14, fontWeight: 600 }}>{lesson.title}</h6>
              </div>
            </div>

            {/* Playlist column */}
            {allPreviews.length > 0 && (
              <div className="vm-playlist">
                <div className="vm-playlist-head">
                  <p style={{ margin: 0, color: "#131836", fontSize: 13, fontWeight: 600 }}>
                    Preview Lessons
                    <span style={{ color: "#aaa", fontWeight: 400, marginLeft: 6 }}>({allPreviews.length})</span>
                  </p>
                </div>
                <div className="vm-playlist-items">
                  {allPreviews.map((preview, idx) => {
                    const isActive = preview.id === lesson.id;
                    return (
                      <div
                        key={preview.id}
                        className={`vm-pitem${isActive ? " active" : ""}`}
                        onClick={() => onSelect(preview)}
                      >
                        <div className="vm-pitem-icon">
                          <i
                            className="flaticon-play-1"
                            style={{ fontSize: 9, color: isActive ? "#fff" : "#aaa" }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="vm-pitem-title" style={{ margin: 0 }}>{preview.title}</p>
                          <p className="vm-pitem-num">Lesson {idx + 1}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

export default function CourseDetailClient({ courseId }) {
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const { addItem, isInCart } = useCart();
  const router = useRouter();

  const [showMore, setShowMore] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [allReviews, setAllReviews] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [previewLesson, setPreviewLesson] = useState(null);
  const REVIEWS_PAGE_SIZE = 5;

  const { data: course, isLoading } = useQuery(
    orpc.getPublicCourseDetail.queryOptions({ input: { id: courseId } }),
  );

  const { data: reviewsData } = useQuery(
    orpc.getPublicCourseReviews.queryOptions({
      input: { courseId, page: 1, pageSize: REVIEWS_PAGE_SIZE },
    }),
  );

  const { data: enrollmentData } = useQuery({
    ...orpc.student.checkEnrollment.queryOptions({ input: { courseId } }),
    enabled: isLoggedIn,
  });

  const isEnrolled = course?.isEnrolled || enrollmentData?.isEnrolled || false;

  const submitReviewMutation = useMutation(
    orpc.student.submitReview.mutationOptions({
      onSuccess: () => {
        setReviewSuccess(true);
        setReviewRating(0);
        setReviewComment("");
        setAllReviews([]);
        setReviewsPage(1);
        qc.invalidateQueries(orpc.getPublicCourseReviews.queryOptions({ input: { courseId, page: 1, pageSize: REVIEWS_PAGE_SIZE } }));
        qc.invalidateQueries(orpc.getPublicCourseDetail.queryOptions({ input: { id: courseId } }));
      },
    }),
  );

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = reviewsPage + 1;
      const result = await qc.fetchQuery(
        orpc.getPublicCourseReviews.queryOptions({
          input: { courseId, page: nextPage, pageSize: REVIEWS_PAGE_SIZE },
        }),
      );
      if (result?.data?.length) {
        setAllReviews((prev) => [...prev, ...result.data]);
        setReviewsPage(nextPage);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tf-container" style={{ padding: "80px 0", textAlign: "center" }}>
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="tf-container" style={{ padding: "80px 0", textAlign: "center" }}>
        <h3>Course not found.</h3>
        <Link href="/courses" className="tf-btn mt-20">Browse Courses</Link>
      </div>
    );
  }

  const hasDiscount = course.discountPrice && course.discountPrice < course.price;
  const displayPrice = hasDiscount ? course.discountPrice : course.price;
  const discountPct = hasDiscount ? Math.round((1 - course.discountPrice / course.price) * 100) : 0;

  const initialReviews = reviewsData?.data ?? [];
  const combinedReviews = [
    ...initialReviews,
    ...allReviews.filter((r) => !initialReviews.some((ir) => ir.id === r.id)),
  ];
  const totalReviews = reviewsData?.total ?? 0;
  const shownCount = initialReviews.length + allReviews.length;
  const hasMore = shownCount < totalReviews;

  const updatedAt = course.createdAt
    ? new Date(course.createdAt).toLocaleDateString("en-US", { month: "numeric", year: "numeric" })
    : "";

  // All free preview VIDEO lessons across chapters
  const freePreviews = (course.chapters || []).flatMap((ch) =>
    ch.lessons.filter((l) => l.isFree && l.muxPlaybackId && l.type === "VIDEO"),
  );

  // Split "what you'll learn" into two equal columns
  const learnItems = course.whatYouWillLearn || [];
  const learnMid = Math.ceil(learnItems.length / 2);
  const learnCol1 = learnItems.slice(0, learnMid);
  const learnCol2 = learnItems.slice(learnMid);

  return (
    <>
      {/* Video preview modal */}
      {previewLesson && (
        <VideoModal
          lesson={previewLesson}
          allPreviews={freePreviews}
          onSelect={setPreviewLesson}
          onClose={() => setPreviewLesson(null)}
        />
      )}

      {/* Page Title */}
      <section className="section-page-title page-title style-4">
        <div className="tf-container">
          <div className="row">
            <div className="col-lg-8">
              <div className="content">
                <ul className="breadcrumbs breadcrumbs flex items-center justify-start gap-10 mb-60">
                  <li>
                    <Link href="/" className="flex">
                      <i className="icon-home" />
                    </Link>
                  </li>
                  <li><i className="icon-arrow-right" /></li>
                  {course.categoryName && (
                    <>
                      <li>
                        <Link href={course.categorySlug ? `/category/${course.categorySlug}` : "/courses"}>
                          {course.categoryName}
                        </Link>
                      </li>
                      <li><i className="icon-arrow-right" /></li>
                    </>
                  )}
                  <li className="line-clamp-1">{course.title}</li>
                </ul>

                <h2 className="font-cardo fw-7">{course.title}</h2>

                {course.description && (
                  <p
                    className="except"
                    style={{ WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    dangerouslySetInnerHTML={{ __html: course.description }}
                  />
                )}

                <ul className="entry-meta">
                  <li>
                    <div className="ratings">
                      <div className="number">{course.avgRating > 0 ? course.avgRating.toFixed(1) : "New"}</div>
                      <i className="icon-star-1" />
                      <i className="icon-star-1" />
                      <i className="icon-star-1" />
                      <i className="icon-star-1" />
                      {STAR_SVG}
                      <p className="total fs-15">{course.reviewCount.toLocaleString()} rating{course.reviewCount !== 1 ? "s" : ""}</p>
                    </div>
                  </li>
                  <li>
                    <i className="flaticon-book" />
                    <p>{course.lessonCount} Lesson{course.lessonCount !== 1 ? "s" : ""}</p>
                  </li>
                  <li>
                    <i className="flaticon-user" />
                    <p>{course.enrollmentCount.toLocaleString()} Student{course.enrollmentCount !== 1 ? "s" : ""}</p>
                  </li>
                  {updatedAt && (
                    <li>
                      <i className="flaticon-clock" />
                      <p>Last updated {updatedAt}</p>
                    </li>
                  )}
                </ul>

                <div className="author-item">
                  <div className="author-item-img">
                    {course.instructorImage ? (
                      <Image
                        src={course.instructorImage}
                        alt={course.instructorName || ""}
                        width={101}
                        height={100}
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: "50%",
                          background: "#5f65f5", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18, fontWeight: 700,
                        }}
                      >
                        {course.instructorName?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <div className="text">
                    <span className="text-1">By </span>
                    <a href="#instructor-section">{course.instructorName}</a>
                    {course.categoryName && (
                      <>
                        <span className="text-1"> In </span>
                        <Link href={course.categorySlug ? `/category/${course.categorySlug}` : "/courses"}>
                          {course.categoryName}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content + Sidebar */}
      <section className="section-page-course">
        <div className="tf-container">
          <div className="row">

            {/* Left Column */}
            <div className="col-lg-8">
              <div className="course-single-inner">

                {/* What You'll Learn */}
                {learnItems.length > 0 && (
                  <div className="page-learn">
                    <h2 className="learn-head text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      What you&apos;ll learn
                    </h2>
                    <div className="learn-inner">
                      <ul className="learn-list">
                        {learnCol1.map((item, i) => (
                          <li key={i} className="item">
                            <i className="flaticon-check" />
                            {item}
                          </li>
                        ))}
                      </ul>
                      {learnCol2.length > 0 && (
                        <ul className="learn-list">
                          {learnCol2.map((item, i) => (
                            <li key={i} className="item">
                              <i className="flaticon-check" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {course.requirements && course.requirements.length > 0 && (
                  <div className="page-requirement">
                    <h2 className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      Requirements
                    </h2>
                    <ul className="list">
                      {course.requirements.map((item, i) => (
                        <li key={i} className="item">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* About / Description */}
                {course.description && (
                  <div className="page-desc show-more-desc-item">
                    <h2 className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      About This Course
                    </h2>
                    <div
                      className="fw-4 fs-15"
                      dangerouslySetInnerHTML={{ __html: course.description }}
                      style={{
                        maxHeight: showMore ? "none" : 150,
                        overflow: "hidden",
                        transition: "max-height 0.4s ease",
                      }}
                    />
                    <div className="more-text">
                      <p
                        className={`${showMore ? "btn-hide-decs" : "btn-show-more-decs"} fw-5`}
                        onClick={() => setShowMore(!showMore)}
                        style={{ cursor: "pointer" }}
                      >
                        {showMore ? (
                          <>Hide <i className="icon-arrow-top" /></>
                        ) : (
                          <>Show More <i className="icon-arrow-bottom" /></>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Course Content / Curriculum */}
                {course.chapters && course.chapters.length > 0 && (
                  <div className="page-course-content">
                    <h2 className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      Course Content
                    </h2>
                    <div className="tf-accordion-style-3 tf-accordion style-course-single">
                      {course.chapters.map((chapter, chIdx) => {
                        const chapterDuration = chapter.lessons.reduce(
                          (sum, l) => sum + (l.durationSeconds || 0),
                          0,
                        );
                        return (
                          <div key={chapter.id} className="tf-accordion-item">
                            <div className="tf-accordion-header">
                              <span
                                className={`tf-accordion-button${chIdx === 0 ? "" : " collapsed"}`}
                                data-bs-toggle="collapse"
                                data-bs-target={`#collapse-${chapter.id}`}
                                aria-expanded={chIdx === 0 ? "true" : "false"}
                                aria-controls={`collapse-${chapter.id}`}
                                style={{ cursor: "pointer" }}
                              >
                                {chapter.title}
                              </span>
                              <div className="sub-header">
                                <p>{chapter.lessons.length} lecture{chapter.lessons.length !== 1 ? "s" : ""}</p>
                                {chapterDuration > 0 && <p>{formatDuration(chapterDuration)}</p>}
                              </div>
                            </div>
                            <div
                              id={`collapse-${chapter.id}`}
                              className={`tf-accordion-collapse collapse${chIdx === 0 ? " show" : ""}`}
                            >
                              <div className="tf-accordion-content">
                                {chapter.lessons.map((lesson) => {
                                  const locked = !lesson.isFree && !isEnrolled;
                                  const canPreview = lesson.isFree && !!lesson.muxPlaybackId && lesson.type === "VIDEO";
                                  return (
                                    <ul
                                      key={lesson.id}
                                      className="list"
                                      style={canPreview ? { cursor: "pointer" } : undefined}
                                      onClick={canPreview ? () => setPreviewLesson(lesson) : undefined}
                                    >
                                      <li className="icon">
                                        <LessonIcon type={lesson.type} />
                                        <span className="text">{lesson.title}</span>
                                      </li>
                                      <li className="sub-list">
                                        {lesson.durationSeconds > 0 && (
                                          <p>{formatDuration(lesson.durationSeconds)}</p>
                                        )}
                                        {canPreview && <p className="preview">Preview</p>}
                                        {locked && <i className="flaticon-lock" />}
                                      </li>
                                    </ul>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Instructor */}
                {course.instructorName && (
                  <div className="page-instructor" id="instructor-section">
                    <h2 className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      Instructor
                    </h2>
                    <div className="instructors-item style-2">
                      <div className="image-wrapper">
                        {course.instructorImage ? (
                          <Image
                            src={course.instructorImage}
                            alt={course.instructorName}
                            width={520}
                            height={521}
                            style={{ objectFit: "cover", width: "100%", height: "auto" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              aspectRatio: "1 / 1",
                              background: "#5f65f5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <span style={{ fontSize: 80, fontWeight: 700, color: "#fff" }}>
                              {course.instructorName.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="entry-content">
                        <h5 className="entry-title">
                          <a href="#">{course.instructorName}</a>
                        </h5>
                        {course.instructorTitle && (
                          <p className="short-description">{course.instructorTitle}</p>
                        )}
                        <ul className="entry-meta">
                          <li>
                            <div className="ratings">
                              <div className="number">
                                {course.instructorAvgRating > 0 ? course.instructorAvgRating.toFixed(1) : "New"}
                              </div>
                              <i className="icon-star-1" />
                              <i className="icon-star-1" />
                              <i className="icon-star-1" />
                              <i className="icon-star-1" />
                              {STAR_SVG}
                              <div className="total">
                                {(course.instructorReviewCount || 0).toLocaleString()} Reviews
                              </div>
                            </div>
                          </li>
                          <li>
                            <i className="flaticon-user" />
                            {(course.instructorStudentCount || 0).toLocaleString()} Student{course.instructorStudentCount !== 1 ? "s" : ""}
                          </li>
                          <li>
                            <i className="flaticon-play" />
                            {course.instructorCourseCount || 0} Course{course.instructorCourseCount !== 1 ? "s" : ""}
                          </li>
                        </ul>
                        {course.instructorBio && (
                          <p className="description">{course.instructorBio}</p>
                        )}
                        <ul className="tf-social-icon flex items-center gap-10">
                          <li><a href="#"><i className="flaticon-facebook-1" /></a></li>
                          <li><a href="#"><i className="icon-twitter" /></a></li>
                          <li><a href="#"><i className="flaticon-instagram" /></a></li>
                          <li><a href="#"><i className="flaticon-linkedin-1" /></a></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reviews */}
                <div className="review-wrap">
                  <div className="review-title flex justify-between items-center">
                    <div className="text-22 fw-5 wow fadeInUp" data-wow-delay="0s">
                      Review
                    </div>
                    <div className="review-rating wow fadeInUp" data-wow-delay="0.1s">
                      <div className="course-rating">
                        <i className="icon-star-1" />
                        <div className="fs-15">
                          {course.avgRating > 0 ? course.avgRating.toFixed(1) : "No"} course rating
                        </div>
                      </div>
                      <div className="rating relative">
                        <div className="fs-15">{totalReviews} rating{totalReviews !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </div>

                  {combinedReviews.length === 0 && (
                    <p className="fs-15" style={{ color: "#888", padding: "20px 0" }}>
                      No reviews yet. Be the first to review this course!
                    </p>
                  )}

                  <style>{`
                    @keyframes skel-shimmer {
                      0%   { background-color: #ececec; }
                      50%  { background-color: #dcdcdc; }
                      100% { background-color: #ececec; }
                    }
                    .skel-line, .skel-circle { animation: skel-shimmer 1.4s ease-in-out infinite; background: #ececec; }
                  `}</style>

                  {combinedReviews.map((review) => (
                    <div key={review.id} className="review-item" style={{ alignItems: "flex-start" }}>
                      {/* .avatar CSS = 60×60px, padding 5px, border-radius 50% — do NOT set inline width/height */}
                      <div className="avatar" style={{ alignSelf: "flex-start", overflow: "hidden" }}>
                        {review.userImage ? (
                          <Image
                            src={review.userImage}
                            alt={review.userName || ""}
                            width={50}
                            height={50}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "50%" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%", height: "100%", borderRadius: "50%",
                              background: "#5f4def", color: "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 19, fontWeight: 700,
                            }}
                          >
                            {review.userName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="comment-box">
                        <h5 className="author-name">
                          <a href="#">{review.userName || "Anonymous"}</a>
                        </h5>
                        <div className="ratings">
                          <div className="number">{review.rating}</div>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <i key={s} className={s <= review.rating ? "icon-star-1" : "flaticon-star"} />
                          ))}
                          <div className="total">
                            <RelativeDate date={review.createdAt} />
                          </div>
                        </div>
                        {review.comment && <p className="comment">{review.comment}</p>}
                        <ul className="reaction">
                          <li className="btn-like"><i className="icon-like" /> Helpful</li>
                          <li className="btn-dislike"><i className="icon-dislike" /> Not helpful</li>
                        </ul>
                      </div>
                    </div>
                  ))}

                  {isLoadingMore && (
                    <>
                      <ReviewSkeleton />
                      <ReviewSkeleton />
                      <ReviewSkeleton />
                    </>
                  )}

                  {!isLoadingMore && hasMore && (
                    <button
                      className="tf-btn style-third w-100"
                      onClick={handleLoadMore}
                      style={{ marginTop: 16 }}
                    >
                      Load More Reviews
                      <i className="icon-arrow-top-right" />
                    </button>
                  )}
                </div>

                {/* Submit Review */}
                <div className="add-review-wrap">
                  <div className="add-review-title text-22 fw-5">Leave A Review</div>

                  {!isLoggedIn && (
                    <div
                      style={{
                        background: "#f5f5f5", borderRadius: 8,
                        padding: "16px 20px", marginTop: 16, color: "#555",
                      }}
                    >
                      <Link href="/login">Log in</Link> to leave a review.
                    </div>
                  )}

                  {isLoggedIn && !isEnrolled && (
                    <div
                      style={{
                        background: "#f5f5f5", borderRadius: 8,
                        padding: "16px 20px", marginTop: 16, color: "#555",
                      }}
                    >
                      You must enroll in this course to leave a review.
                    </div>
                  )}

                  {isLoggedIn && isEnrolled && (
                    <>
                      {reviewSuccess && (
                        <div
                          style={{
                            background: "#e8f5e9", borderRadius: 8,
                            padding: "12px 20px", marginTop: 16, color: "#2e7d32",
                          }}
                        >
                          Your review has been submitted. Thank you!
                        </div>
                      )}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!reviewRating) return;
                          setReviewSuccess(false);
                          submitReviewMutation.mutate({
                            courseId,
                            rating: reviewRating,
                            comment: reviewComment || undefined,
                          });
                        }}
                        className="form-add-review"
                        style={{ marginTop: 16 }}
                      >
                        <div style={{ marginBottom: 16 }}>
                          <h6 className="fw-5" style={{ marginBottom: 8 }}>Your Rating</h6>
                          <StarRating value={reviewRating} onChange={setReviewRating} />
                        </div>
                        <fieldset className="tf-field">
                          <textarea
                            className="tf-input style-1"
                            rows={4}
                            placeholder="Share your experience with this course (optional)"
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                          />
                        </fieldset>
                        <div className="button-submit" style={{ marginTop: 16 }}>
                          <button
                            className="tf-btn w-100"
                            type="submit"
                            disabled={!reviewRating || submitReviewMutation.isPending}
                          >
                            {submitReviewMutation.isPending ? "Submitting..." : "Post Review"}
                            <i className="icon-arrow-top-right" />
                          </button>
                        </div>
                        {submitReviewMutation.isError && (
                          <p style={{ color: "red", marginTop: 8 }}>
                            {submitReviewMutation.error?.message || "Failed to submit review."}
                          </p>
                        )}
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-lg-4">
              <div className="sidebar-course course-single-v1">
                <div className="widget-video">
                  {course.thumbnailUrl ? (
                    <Image
                      src={course.thumbnailUrl}
                      alt={course.title}
                      width={520}
                      height={380}
                      style={{ objectFit: "cover", width: "100%" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%", height: 220, background: "#1a1a2e",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <i className="flaticon-play fs-40" style={{ color: "#fff" }} />
                    </div>
                  )}
                  {freePreviews.length > 0 && (
                    <a
                      href="#"
                      className="popup-youtube"
                      onClick={(e) => { e.preventDefault(); setPreviewLesson(freePreviews[0]); }}
                    >
                      <i className="flaticon-play fs-18" />
                    </a>
                  )}
                </div>

                <div className="sidebar-course-content">
                  <div className="course-price">
                    <div className="price">
                      <h3 className="fw-5">{formatPrice(displayPrice)}</h3>
                      {hasDiscount && (
                        <h6 className="fs-15" style={{ textDecoration: "line-through", color: "#999" }}>
                          {formatPrice(course.price)}
                        </h6>
                      )}
                    </div>
                    {hasDiscount && <p className="sale-off">{discountPct}% OFF</p>}
                  </div>

                  {isEnrolled ? (
                    // Already enrolled — go straight to learning
                    <Link href={`/courses/${courseId}/learn`} className="tf-btn add-to-cart">
                      Go to Course
                      <i className="icon-arrow-top-right" />
                    </Link>
                  ) : isInCart(courseId) ? (
                    // In cart — view cart
                    <Link href="/cart" className="tf-btn add-to-cart">
                      View Cart
                      <i className="icon-shopcart" />
                    </Link>
                  ) : (
                    // Not enrolled, not in cart — add to cart
                    <button
                      className="tf-btn add-to-cart"
                      style={{ width: "100%", border: "none", cursor: "pointer" }}
                      onClick={() =>
                        addItem({
                          courseId,
                          title: course.title,
                          price: course.price ?? 0,
                          discountPrice: course.discountPrice ?? 0,
                          thumbnailUrl: course.thumbnailUrl ?? null,
                          instructorName: course.instructorName ?? "",
                        })
                      }
                    >
                      {course.price === 0 ? "Enroll Free" : "Add To Cart"}
                      <i className="icon-arrow-top-right" />
                    </button>
                  )}
                  {/* Buy Now — only if not enrolled and not in cart and course is paid */}
                  {!isEnrolled && !isInCart(courseId) && course.price > 0 && (
                    <button
                      className="tf-btn buy-now"
                      style={{ width: "100%", border: "none", cursor: "pointer" }}
                      onClick={() => {
                        addItem({
                          courseId,
                          title: course.title,
                          price: course.price ?? 0,
                          discountPrice: course.discountPrice ?? 0,
                          thumbnailUrl: course.thumbnailUrl ?? null,
                          instructorName: course.instructorName ?? "",
                        });
                        router.push("/checkout");
                      }}
                    >
                      Buy Now
                      <i className="icon-arrow-top-right" />
                    </button>
                  )}
                  <h6 className="course-text">30-Day Money-Back Guarantee</h6>

                  <div className="course-list">
                    <h5 className="fw-5">This course includes:</h5>
                    <ul className="course-benefit-list">
                      {course.inclusions && course.inclusions.length > 0 ? (
                        course.inclusions.map((item, i) => (
                          <li key={i} className="course-benefit-item">
                            <i className="flaticon-play-1" />
                            <p>{item}</p>
                          </li>
                        ))
                      ) : (
                        <>
                          {course.totalDurationSeconds > 0 && (
                            <li className="course-benefit-item">
                              <i className="flaticon-play-1" />
                              <p>{formatDuration(course.totalDurationSeconds)} on-demand video</p>
                            </li>
                          )}
                          <li className="course-benefit-item">
                            <i className="flaticon-mobile-phone" />
                            <p>Access on mobile and TV</p>
                          </li>
                          <li className="course-benefit-item">
                            <i className="icon-extremely" />
                            <p>Full lifetime access</p>
                          </li>
                          <li className="course-benefit-item">
                            <i className="flaticon-medal" />
                            <p>Certificate of completion</p>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="course-social">
                  <h6 className="fw-5">Share this course</h6>
                  <ul>
                    <li><a href="#"><i className="flaticon-facebook-1" /></a></li>
                    <li className="course-social-item"><a href="#"><i className="icon-twitter" /></a></li>
                    <li className="course-social-item"><a href="#"><i className="flaticon-instagram" /></a></li>
                    <li className="course-social-item"><a href="#"><i className="flaticon-linkedin-1" /></a></li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
