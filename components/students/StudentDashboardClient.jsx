"use client";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { formatPrice } from "@/lib/formatPrice";
import StudentDashboardNav from "./StudentDashboardNav";

function StatBox({ icon, label, value, delay }) {
  return (
    <div className="icons-box style-4 wow fadeInUp" data-wow-delay={delay}>
      <div className="icons">
        <i className={icon} />
      </div>
      <div className="content">
        <h6>{label}</h6>
        <span className="num-count fs-26 fw-5">{value}</span>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="icons-box style-4">
      <div
        style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }}
      />
      <div className="content">
        <div style={{ height: 14, width: 90, background: "rgba(255,255,255,0.15)", borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 20, width: 40, background: "rgba(255,255,255,0.15)", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function RecentCourseRow({ course }) {
  const price = course.discountPrice > 0 ? course.discountPrice : course.price;
  const enrolledDate = course.enrolledAt
    ? new Date(course.enrolledAt).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <li>
      <div className="selling-course-item item my-20 ptable-20 border-bottom">
        <div className="image">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 4 }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 60,
                background: "#f4f4f4",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="flaticon-online-training" style={{ fontSize: 24, color: "#ccc" }} />
            </div>
          )}
        </div>
        <div className="title">
          <Link className="fs-15 fw-5" href={`/courses/${course.courseId}`}>
            {course.title}
          </Link>
          {course.instructorName && (
            <p className="fs-13" style={{ color: "#888", marginTop: 2 }}>
              {course.instructorName}
            </p>
          )}
        </div>
        <div>
          <p className="fs-15 fw-5">
            {course.lessonCount ?? 0} lesson{course.lessonCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div>
          <p className="fs-15 fw-5">{enrolledDate}</p>
        </div>
        <div>
          <Link href={`/courses/${course.courseId}/learn`} className="tf-btn style-third">
            Continue <i className="icon-arrow-top-right" />
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function StudentDashboardClient() {
  const { data: session } = authClient.useSession();
  const { data: courses = [], isLoading } = useQuery(
    orpc.student.getEnrolledCourses.queryOptions(),
  );

  const user = session?.user;
  const initials = user?.name?.charAt(0)?.toUpperCase() || "S";
  const totalLessons = courses.reduce((sum, c) => sum + (c.lessonCount || 0), 0);
  const recentCourses = courses.slice(0, 4);

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
                      {courses.length} Course{courses.length !== 1 ? "s" : ""} Enrolled
                    </li>
                    <li>
                      <i className="flaticon-play-1" />
                      {totalLessons} Lessons Available
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="right-content">
                <Link className="tf-btn" href="/courses">
                  Browse Courses
                  <i className="icon-arrow-top-right" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard body */}
      <div className="main-content pt-0">
        <div className="page-inner tf-spacing-1">
          <div className="tf-container">
            <div className="row">
              <StudentDashboardNav />

              {/* Main right column */}
              <div className="col-xl-9 col-lg-12">
                <div className="section-dashboard-right">

                  {/* Stats */}
                  <div className="section-icons">
                    <div className="row">
                      <div className="icons-items">
                        {isLoading ? (
                          <>
                            <StatSkeleton />
                            <StatSkeleton />
                            <StatSkeleton />
                          </>
                        ) : (
                          <>
                            <StatBox
                              icon="flaticon-play-2"
                              label="Enrolled Courses"
                              value={courses.length}
                            />
                            <StatBox
                              icon="flaticon-calendar"
                              label="Total Lessons"
                              value={totalLessons}
                              delay="0.1s"
                            />
                            <StatBox
                              icon="flaticon-alarm"
                              label="In Progress"
                              value={courses.length}
                              delay="0.2s"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Courses */}
                  <div className="section-learn">
                    <div className="heading-section flex justify-between items-center">
                      <h6 className="fw-5 fs-22 wow fadeInUp">My Recent Courses</h6>
                      <Link
                        href="/my-courses"
                        className="tf-btn-arrow wow fadeInUp"
                        data-wow-delay="0.1s"
                      >
                        View All <i className="icon-arrow-top-right" />
                      </Link>
                    </div>

                    {isLoading ? (
                      <div className="wg-box" style={{ padding: "20px 30px" }}>
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            style={{
                              height: 68,
                              background: "#f4f4f4",
                              borderRadius: 8,
                              marginBottom: 12,
                            }}
                          />
                        ))}
                      </div>
                    ) : recentCourses.length === 0 ? (
                      <div
                        className="wg-box"
                        style={{ padding: "40px 30px", textAlign: "center", color: "#888" }}
                      >
                        <i
                          className="flaticon-online-training"
                          style={{ fontSize: 48, color: "#ccc", display: "block", marginBottom: 12 }}
                        />
                        <p style={{ marginBottom: 20 }}>
                          You haven&apos;t enrolled in any courses yet.
                        </p>
                        <Link href="/courses" className="tf-btn">
                          Browse Courses <i className="icon-arrow-top-right" />
                        </Link>
                      </div>
                    ) : (
                      <div className="wg-box">
                        <div className="table-selling-course wow fadeInUp">
                          <div className="head">
                            <div className="item">
                              <div className="fs-15 fw-5">Course</div>
                            </div>
                            <div className="item">
                              <div className="fs-15 fw-5">Lessons</div>
                            </div>
                            <div className="item">
                              <div className="fs-15 fw-5">Enrolled</div>
                            </div>
                            <div className="item">
                              <div className="fs-15 fw-5">Action</div>
                            </div>
                          </div>
                          <ul>
                            {recentCourses.map((course) => (
                              <RecentCourseRow key={course.courseId} course={course} />
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
