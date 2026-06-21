"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { orpc } from "@/lib/orpc";
import MuxPlayer from "@mux/mux-player-react";
import Link from "next/link";
import QuizPlayer from "@/components/students/QuizPlayer";

function fmtDuration(secs) {
  if (!secs || secs <= 0) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const ICON_STYLE = { fontSize: 14, flexShrink: 0, lineHeight: 1 };

function LessonTypeIcon({ type, completed }) {
  if (completed) return <i className="flaticon-check" style={{ ...ICON_STYLE, color: "#2ecc71" }} />;
  if (type === "QUIZ") return <i className="flaticon-question" style={ICON_STYLE} />;
  if (type === "FILE") return <i className="flaticon-document" style={ICON_STYLE} />;
  return <i className="flaticon-play-1" style={ICON_STYLE} />;
}

export default function CourseLearningClient({ courseId }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const lessonId = searchParams.get("lesson");

  // sidebarOpen = false means content visible (default); true = sidebar open (mobile overlay)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openChapters, setOpenChapters] = useState(() => new Set());

  const muxRef = useRef(null);
  const lastSavedSecondsRef = useRef(0);
  const hasAutoCompletedRef = useRef(false);

  const queryOpts = orpc.student.getCourseLearnData.queryOptions({ input: { courseId } });
  const { data, isLoading, error } = useQuery({ ...queryOpts, retry: false });

  const allLessons = data ? data.chapters.flatMap((c) => c.lessons) : [];

  const currentLesson = lessonId
    ? (allLessons.find((l) => l.id === lessonId) ?? allLessons[0])
    : allLessons[0];

  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Redirect to first lesson when no lesson param
  useEffect(() => {
    if (!lessonId && allLessons.length > 0) {
      router.replace(`/courses/${courseId}/learn?lesson=${allLessons[0].id}`);
    }
  }, [lessonId, allLessons.length]);

  // Auto-open the chapter that contains the current lesson
  const currentChapterId = data?.chapters.find((c) =>
    c.lessons.some((l) => l.id === currentLesson?.id),
  )?.id;

  useEffect(() => {
    if (currentChapterId) {
      setOpenChapters((prev) => new Set([...prev, currentChapterId]));
    }
  }, [currentChapterId]);

  // Reset progress refs when lesson changes
  useEffect(() => {
    lastSavedSecondsRef.current = 0;
    hasAutoCompletedRef.current = currentLesson?.isCompleted ?? false;
  }, [currentLesson?.id, currentLesson?.isCompleted]);

  const toggleChapter = useCallback((id) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const navigateToLesson = useCallback(
    (lesson) => router.push(`/courses/${courseId}/learn?lesson=${lesson.id}`),
    [courseId],
  );

  const markCompleteMutation = useMutation(
    orpc.student.markLessonComplete.mutationOptions({
      onSuccess: () => qc.invalidateQueries(queryOpts),
    }),
  );

  const progressMutation = useMutation(
    orpc.student.updateVideoProgress.mutationOptions({
      onSuccess: (res) => {
        if (res.isCompleted) qc.invalidateQueries(queryOpts);
      },
    }),
  );

  // Fires on video timeupdate — saves every 15s, auto-completes at 80%
  const handleTimeUpdate = useCallback(() => {
    const el = muxRef.current;
    if (!el || !currentLesson) return;
    const ct = el.currentTime;
    const dur = el.duration;
    if (!dur || dur <= 0) return;

    if (ct - lastSavedSecondsRef.current >= 15) {
      lastSavedSecondsRef.current = ct;
      progressMutation.mutate({ lessonId: currentLesson.id, secondsWatched: ct, duration: dur });
    }
    if (!hasAutoCompletedRef.current && ct >= dur * 0.8) {
      hasAutoCompletedRef.current = true;
      progressMutation.mutate({ lessonId: currentLesson.id, secondsWatched: ct, duration: dur });
    }
  }, [currentLesson?.id]);

  const progressPct = data
    ? Math.round((data.completedLessons / Math.max(data.totalLessons, 1)) * 100)
    : 0;

  const isCompleted = currentLesson?.isCompleted ?? false;

  // ── Error state ──
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 16,
          padding: 40,
        }}
      >
        <i className="flaticon-close-1" style={{ fontSize: 48, color: "#E27447" }} />
        <h4 style={{ margin: 0 }}>Access Denied</h4>
        <p style={{ color: "#888", margin: 0 }}>
          You must be enrolled in this course to view it.
        </p>
        <Link href="/my-courses" className="tf-btn">
          My Courses <i className="icon-arrow-top-right" />
        </Link>
      </div>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    const shimmer = { background: "linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.13) 50%,rgba(255,255,255,0.06) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" };
    const lightShimmer = { background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" };
    return (
      <>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div className="main-content main-content-page-lesson" style={{ height: "100vh", overflow: "hidden" }}>

          {/* Sidebar skeleton */}
          <section className="lesson-page-sidebar" style={{ height: "100vh", overflowY: "auto" }}>
            <div className="sidebar-title">
              <div style={{ height: 18, width: 130, borderRadius: 4, ...shimmer }} />
            </div>
            <div style={{ padding: "0 28px 20px" }}>
              <div style={{ height: 5, borderRadius: 3, marginBottom: 8, ...shimmer }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ height: 11, width: 80, borderRadius: 3, ...shimmer }} />
                <div style={{ height: 11, width: 28, borderRadius: 3, ...shimmer }} />
              </div>
            </div>
            <div style={{ padding: "0 16px" }}>
              {[1, 2, 3].map((n) => (
                <div key={n} style={{ marginBottom: 16 }}>
                  <div style={{ height: 42, borderRadius: 6, marginBottom: 6, ...shimmer }} />
                  {[1, 2, 3].map((m) => (
                    <div key={m} style={{ height: 34, borderRadius: 4, marginBottom: 4, marginLeft: 8, opacity: 0.6, ...shimmer }} />
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Content skeleton */}
          <section className="lesson-page-content section-page-course" style={{ height: "100vh", overflowY: "auto" }}>
            <div className="lesson-top">
              <div className="top-left" style={{ gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, ...lightShimmer }} />
                <div style={{ height: 20, width: 220, borderRadius: 4, ...lightShimmer }} />
              </div>
            </div>
            {/* Video area skeleton */}
            <div style={{ background: "#111", aspectRatio: "16/9", maxHeight: 560, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="flaticon-play-1" style={{ fontSize: 26, color: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>
            {/* Lesson detail skeleton */}
            <div style={{ padding: "40px 30px 60px" }}>
              <div style={{ height: 26, width: "55%", borderRadius: 5, marginBottom: 14, ...lightShimmer }} />
              <div style={{ height: 13, width: "25%", borderRadius: 4, marginBottom: 32, ...lightShimmer }} />
              <div style={{ height: 13, width: "100%", borderRadius: 4, marginBottom: 8, ...lightShimmer }} />
              <div style={{ height: 13, width: "88%", borderRadius: 4, marginBottom: 8, ...lightShimmer }} />
              <div style={{ height: 13, width: "72%", borderRadius: 4, ...lightShimmer }} />
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <div className="main-content main-content-page-lesson" style={{ height: "100vh", overflow: "hidden" }}>

      {/* ══════════════════════════════════════════
          SIDEBAR — Course Content
          On mobile (≤1200px): hidden by default, shown when sidebarOpen=true via open-lesson-sidebar
          On desktop (>1200px): always visible regardless of state
      ══════════════════════════════════════════ */}
      <section
        className={`lesson-page-sidebar${sidebarOpen ? " open-lesson-sidebar" : ""}`}
        style={{ height: "100vh", overflowY: "auto" }}
      >
        <div className="sidebar-title">
          <h2 className="text-22 fw-5">Course Content</h2>
          {/* sidebar-title-close only visible on mobile (CSS: display:none on desktop) */}
          <i
            className="flaticon-close-1 sidebar-title-close"
            onClick={() => setSidebarOpen(false)}
          />
        </div>

        {/* Course progress */}
        <div style={{ padding: "0 30px 20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 6,
              opacity: 0.7,
            }}
          >
            <span>{data.completedLessons} / {data.totalLessons} lessons</span>
            <span style={{ fontWeight: 700, color: progressPct === 100 ? "#2ecc71" : "#E27447" }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: progressPct === 100 ? "#2ecc71" : "#E27447",
                borderRadius: 3,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Chapters + lessons accordion */}
        <div className="page-lesson-accordion tf-accordion-style-3 tf-accordion">
          {data.chapters.map((chapter) => {
            const isOpen = openChapters.has(chapter.id);
            const doneCount = chapter.lessons.filter((l) => l.isCompleted).length;

            return (
              <div key={chapter.id} className="tf-accordion-item">
                <div
                  className="tf-accordion-header"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleChapter(chapter.id)}
                >
                  {/* tf-accordion-button: CSS adds chevron via ::after pseudo-element */}
                  <span className={`tf-accordion-button${isOpen ? "" : " collapsed"}`}>
                    {chapter.title}
                  </span>
                  <div className="sub-header">
                    <p>{chapter.lessons.length} lessons</p>
                    <p style={{ color: doneCount === chapter.lessons.length && chapter.lessons.length > 0 ? "#2ecc71" : undefined }}>
                      {doneCount}/{chapter.lessons.length}
                    </p>
                  </div>
                </div>

                {/* Bootstrap CSS: .collapse:not(.show) { display: none !important } */}
                <div className={`tf-accordion-collapse collapse${isOpen ? " show" : ""}`}>
                  <div className="tf-accordion-content">
                    {chapter.lessons.map((lesson) => {
                      const isActive = lesson.id === currentLesson?.id;
                      return (
                        <ul
                          key={lesson.id}
                          className="list"
                          style={{ cursor: "pointer" }}
                          onClick={() => navigateToLesson(lesson)}
                        >
                          <li
                            className="icon"
                            style={{
                              width: "100%",
                              paddingLeft: 16,
                              paddingRight: 4,
                              borderLeft: isActive ? "3px solid #E27447" : "3px solid transparent",
                              background: isActive ? "rgba(226,116,71,0.08)" : undefined,
                              transition: "background 0.15s",
                            }}
                          >
                            <LessonTypeIcon type={lesson.type} completed={lesson.isCompleted} />
                            <span
                              className="text"
                              style={{
                                fontWeight: isActive ? 600 : undefined,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {lesson.title}
                            </span>
                          </li>
                          <li
                            className="sub-list"
                            style={{
                              paddingLeft: 19,
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {lesson.durationSeconds > 0 && (
                              <span style={{ fontSize: 13 }}>{fmtDuration(lesson.durationSeconds)}</span>
                            )}
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
      </section>

      {/* ══════════════════════════════════════════
          MAIN CONTENT — Player + Lesson Details
          On mobile: hidden when sidebar is open (.lesson-page-close)
      ══════════════════════════════════════════ */}
      <section
        className={`lesson-page-content section-page-course${sidebarOpen ? " lesson-page-close" : ""}`}
        style={{ height: "100vh", overflowY: "auto" }}
      >
        {/* ── Top bar ── */}
        <div className="lesson-top">
          <div className="top-left">
            {/* btns-style-arrow: CSS hides on mobile (display:none at ≤1366px) */}
            <Link href="/my-courses" className="btns-style-arrow">
              <i className="icon-arrow-left" />
            </Link>
            <h4 className="fw-5">{data.course.title}</h4>
          </div>
          <div className="icon-right">
            {/* flaticon-close-1: shown on desktop, hidden on mobile via CSS */}
            <Link href="/my-courses" style={{ color: "inherit" }}>
              <i className="flaticon-close-1" />
            </Link>
            {/* btn-nav-lesson: empty <a> — CSS draws the burger bars via ::before/::after */}
            <a
              className="btn-nav-lesson"
              href="#"
              onClick={(e) => { e.preventDefault(); setSidebarOpen(true); }}
            />
          </div>
        </div>

        {/* ── Video / FILE / QUIZ content area ── */}
        {currentLesson?.type === "VIDEO" && currentLesson?.muxPlaybackId ? (
          <div className="lesson-video widget-video">
            <MuxPlayer
              ref={muxRef}
              streamType="on-demand"
              playbackId={currentLesson.muxPlaybackId}
              accentColor="#E27447"
              style={{ width: "100%", maxHeight: 700, display: "block" }}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        ) : currentLesson?.type === "VIDEO" ? (
          <div
            className="lesson-video widget-video"
            style={{
              background: "#111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 320,
              flexDirection: "column",
              gap: 12,
              color: "#555",
            }}
          >
            <i className="flaticon-play-1" style={{ fontSize: 48 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Video is being processed. Check back soon.</p>
          </div>
        ) : currentLesson?.type === "FILE" && currentLesson?.fileUrl ? (
          <div
            style={{
              background: "#f8f9fc",
              borderBottom: "1px solid #eef0f6",
              padding: "36px 30px",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#E27447",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className="flaticon-document" style={{ fontSize: 22, color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>
                {currentLesson.fileName || "Resource File"}
              </p>
              <p style={{ color: "#888", fontSize: 14, margin: 0 }}>Download this lesson resource</p>
            </div>
            <a
              href={currentLesson.fileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="tf-btn"
            >
              Download <i className="icon-arrow-top-right" />
            </a>
          </div>
        ) : currentLesson?.type === "QUIZ" ? (
          currentLesson.quizId ? (
            <QuizPlayer quizId={currentLesson.quizId} />
          ) : (
            <div
              style={{
                background: "#f8f9fc",
                borderBottom: "1px solid #eef0f6",
                padding: "60px 30px",
                textAlign: "center",
                color: "#888",
              }}
            >
              <i
                className="flaticon-question"
                style={{ fontSize: 48, color: "#ccc", display: "block", marginBottom: 12 }}
              />
              <p style={{ margin: 0, fontSize: 15 }}>No quiz has been assigned to this lesson yet.</p>
            </div>
          )
        ) : null}

        {/* ── Lesson detail inner ── */}
        <div className="lesson-inner course-single-inner" style={{ paddingTop: 40, paddingBottom: 60 }}>
          {currentLesson ? (
            <>
              {/* Lesson header row — title left, mark-complete button right */}
              <div className="page-learn">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 20,
                    borderBottom: "1px solid var(--Border)",
                    paddingBottom: 24,
                  }}
                >
                  <div>
                    <h2 className="text-22 fw-5" style={{ marginBottom: 6 }}>
                      {currentLesson.title}
                    </h2>
                    {currentLesson.durationSeconds > 0 && (
                      <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
                        <i className="flaticon-clock" style={{ marginRight: 6 }} />
                        {fmtDuration(currentLesson.durationSeconds)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="tf-btn"
                    onClick={() =>
                      markCompleteMutation.mutate({ lessonId: currentLesson.id, completed: !isCompleted })
                    }
                    disabled={markCompleteMutation.isPending}
                    style={{
                      flexShrink: 0,
                      background: isCompleted ? "#2ecc71" : undefined,
                      borderColor: isCompleted ? "#2ecc71" : undefined,
                    }}
                  >
                    {isCompleted ? (
                      <>
                        <i className="flaticon-check" style={{ marginRight: 6 }} />
                        Completed
                      </>
                    ) : (
                      <>
                        <i className="flaticon-circle" style={{ marginRight: 6 }} />
                        Mark as Complete
                      </>
                    )}
                  </button>
                </div>

                {/* Description */}
                {currentLesson.description && (
                  <div className="page-desc" style={{ marginBottom: 20 }}>
                    <p className="fw-4 fs-15">{currentLesson.description}</p>
                  </div>
                )}

                {/* Course progress summary */}
                <div
                  style={{
                    background: "#f8f9fc",
                    borderRadius: 8,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 24,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#E27447",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{progressPct}%</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Course Progress</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                      {data.completedLessons} of {data.totalLessons} lessons completed
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 6, background: "#e0e0e0", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${progressPct}%`,
                          background: progressPct === 100 ? "#2ecc71" : "#E27447",
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>
              <p>Select a lesson from the sidebar to begin.</p>
            </div>
          )}

          {/* ── Previous / Next navigation ── */}
          <div className="page-btn">
            {prevLesson ? (
              <button
                type="button"
                className="tf-btn btn-prev"
                onClick={() => navigateToLesson(prevLesson)}
              >
                Previous
                <i className="icon-arrow-top-right" />
              </button>
            ) : (
              <div />
            )}

            {nextLesson ? (
              <button
                type="button"
                className="tf-btn btn-next"
                onClick={() => navigateToLesson(nextLesson)}
              >
                Next
                <i className="icon-arrow-top-right" />
              </button>
            ) : (
              <Link href="/my-courses" className="tf-btn btn-next">
                Back to My Courses <i className="icon-arrow-top-right" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
