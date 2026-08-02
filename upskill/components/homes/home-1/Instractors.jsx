"use client";
import { Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import Image from "next/image";

/**
 * Homepage instructor carousel.
 *
 * Was hardcoded to the template's `@/upskill/data/instractors` demo array. It now takes real
 * rows from `getFeaturedInstructors` (instructors with at least one PUBLISHED course, best
 * rated first), server-fetched by app/(student)/page.tsx so there is no client-side waterfall.
 *
 * Two template links were also dead: cards pointed at /instructor-single/[id] and the CTA at
 * /instructor-list. The real routes are /instructors/[id] and /instructors.
 */

const AVATAR_FALLBACK = "/images/avatar/user-1.png";

function formatStudents(n) {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   image?: string | null,
 *   title?: string | null,
 *   bio?: string | null,
 *   courseCount: number,
 *   studentCount: number,
 *   avgRating: number,
 * }} FeaturedInstructor
 *
 * @param {{ instructors?: FeaturedInstructor[] }} props
 */
export default function Instractors({ instructors = [] }) {
  // Nothing worth showing — hide the section rather than render an empty carousel.
  if (!instructors.length) return null;

  const options = {
    spaceBetween: 25,
    observer: true,
    observeParents: true,
    breakpoints: {
      425: { slidesPerView: 1.5, spaceBetween: 15 },
      700: { slidesPerView: 2.3 },
      1000: { slidesPerView: 3 },
      1440: { slidesPerView: 5 },
    },
  };

  return (
    <section className="section-instructor tf-spacing-3 pt-0">
      <div className="tf-container">
        <div className="row">
          <div className="col-12">
            <div className="heading-section">
              <h2 className="fw-7 font-cardo wow fadeInUp" data-wow-delay="0s">
                Learn From The Best Instructors
              </h2>
              <div className="flex items-center justify-between flex-wrap gap-10">
                <div className="sub fs-15 wow fadeInUp" data-wow-delay="0.1s">
                  Experts sharing what they actually do for a living.
                </div>
                <Link
                  href="/instructors"
                  className="tf-btn-arrow wow fadeInUp"
                  data-wow-delay="0.2s"
                >
                  See All Instructors <i className="icon-arrow-top-right" />
                </Link>
              </div>
            </div>
            <Swiper
              className="swiper-container slider-courses-5 wow fadeInUp"
              data-wow-delay="0.3s"
              {...options}
              modules={[Navigation, Pagination]}
            >
              {instructors.map((instructor) => {
                const rating = Number(instructor.avgRating) || 0;
                return (
                  <SwiperSlide className="swiper-slide" key={instructor.id}>
                    <div className="instructors-item hover-img style-column">
                      <div className="image-wrap">
                        <Image
                          className="lazyload"
                          alt={instructor.name || "Instructor"}
                          src={instructor.image || AVATAR_FALLBACK}
                          width={520}
                          height={521}
                          style={{ objectFit: "cover" }}
                        />
                      </div>
                      <div className="entry-content">
                        <ul className="entry-meta">
                          <li>
                            <i className="flaticon-user" />
                            {formatStudents(instructor.studentCount)} Students
                          </li>
                          <li>
                            <i className="flaticon-play" />
                            {instructor.courseCount}{" "}
                            {instructor.courseCount === 1 ? "Course" : "Courses"}
                          </li>
                        </ul>
                        <h6 className="entry-title">
                          <Link href={`/instructors/${instructor.id}`}>
                            {instructor.name}
                          </Link>
                        </h6>
                        <p className="short-description">
                          {instructor.title || instructor.bio || "Instructor at TYIMS"}
                        </p>
                        {rating > 0 && (
                          <div className="ratings">
                            <div className="number">{rating.toFixed(1)}</div>
                            <i className="icon-star-1" />
                          </div>
                        )}
                      </div>
                    </div>
                  </SwiperSlide>
                );
              })}
            </Swiper>
          </div>
        </div>
      </div>
    </section>
  );
}
