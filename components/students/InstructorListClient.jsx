"use client";

import React, { useState, useEffect, useRef } from "react";
import { orpc } from "@/lib/orpc";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { value: "rating_desc", label: "Highest Rated" },
];

const PAGE_SIZE = 15;

export default function InstructorListClient({ initialData = null } = {}) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sort, setSort] = useState("default");

  const sortRef = useRef(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, sort]);

  // Sort dropdown outside-click handler
  useEffect(() => {
    const handleOutside = (event) => {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        sortRef.current.classList.remove("open");
      }
    };
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, []);

  const toggleSortDropdown = (e) => {
    e.stopPropagation();
    sortRef.current?.classList.toggle("open");
  };

  const selectSort = (val) => {
    setSort(val);
    sortRef.current?.classList.remove("open");
  };

  const input = {
    page,
    pageSize: PAGE_SIZE,
    ...(debouncedQ ? { q: debouncedQ } : {}),
    sort,
  };

  const initialDataMatches =
    initialData && !debouncedQ && sort === "default" && page === 1;

  const { data, isLoading, isFetching } = useQuery({
    ...orpc.getPublicInstructors.queryOptions({ input }),
    placeholderData: keepPreviousData,
    ...(initialDataMatches ? { initialData } : {}),
  });

  const instructors = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label || "Default";

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages]);
    for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) {
      pages.add(i);
    }
    return [...pages].sort((a, b) => a - b);
  })();

  return (
    <>
      {/* Filter bar */}
      <div className="tf-spacing-10 pb-0">
        <div className="tf-container">
          <div className="row">
            <div className="col-12">
              <div className="top-wrapper page-instructor">
                <div className="group-filter">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setDebouncedQ(q);
                    }}
                    className="form-search wow fadeInUp"
                  >
                    <fieldset>
                      <input
                        type="text"
                        placeholder="Search for instructors"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        tabIndex={2}
                        aria-required="true"
                      />
                    </fieldset>
                    <div className="button-submit">
                      <button type="submit">
                        <i className="icon-search fs-20" />
                      </button>
                    </div>
                  </form>
                </div>
                <div className="sort-by-wrap mt-0">
                  <div className="sort-wrap">
                    <div className="sort-by">
                      <p className="text text-2 wow fadeInUp" data-wow-delay="0.1s">
                        Sort by
                      </p>
                      <div
                        className="nice-select default wow fadeInUp"
                        data-wow-delay="0.1s"
                        ref={sortRef}
                        tabIndex={0}
                      >
                        <span onClick={toggleSortDropdown} className="text text-1">
                          {selectedSortLabel}
                        </span>
                        <ul className="list">
                          {SORT_OPTIONS.map(({ value, label }) => (
                            <li
                              key={value}
                              className={`option text text-1${sort === value ? " selected focus" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectSort(value);
                              }}
                            >
                              {label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructor grid */}
      <section className="section-instructor page-instructor tf-spacing-4 pt-0">
        <div className="tf-container">
          <div className="row">
            <div className="col-12">
              <div style={{ position: "relative" }}>
                {/* Fetching overlay */}
                {isFetching && instructors.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(255,255,255,0.55)",
                      zIndex: 5,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: 60,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#E27447",
                            animation: "ins-pulse 1.2s ease-in-out infinite",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {isLoading ? (
                  <div className="grid-layout-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="instructors-item hover-img style-column">
                        <div
                          className="image-wrap"
                          style={{ background: "#f0f0f0", aspectRatio: "1/1" }}
                        />
                        <div className="entry-content">
                          <div style={{ height: 12, background: "#f0f0f0", borderRadius: 4, marginBottom: 8, width: "70%" }} />
                          <div style={{ height: 18, background: "#f0f0f0", borderRadius: 4, marginBottom: 6 }} />
                          <div style={{ height: 14, background: "#f0f0f0", borderRadius: 4, width: "55%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid-layout-5">
                    {instructors.map((instructor) => (
                      <div
                        key={instructor.id}
                        className="instructors-item hover-img style-column wow fadeInUp"
                      >
                        <div className="image-wrap">
                          {instructor.image ? (
                            <Image
                              alt={instructor.name || ""}
                              src={instructor.image}
                              width={520}
                              height={521}
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
                                fontSize: 56,
                                fontWeight: 700,
                              }}
                            >
                              {instructor.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          )}
                        </div>
                        <div className="entry-content">
                          <ul className="entry-meta">
                            <li>
                              <i className="flaticon-user" />
                              {instructor.studentCount ?? 0} Students
                            </li>
                            <li>
                              <i className="flaticon-play" />
                              {instructor.courseCount ?? 0} Course
                            </li>
                          </ul>
                          <h6 className="entry-title">
                            <Link href={`/instructors/${instructor.id}`}>
                              {instructor.name}
                            </Link>
                          </h6>
                          <p className="short-description">
                            {instructor.title ||
                              (instructor.bio
                                ? instructor.bio.replace(/<[^>]+>/g, "").slice(0, 80) +
                                  (instructor.bio.replace(/<[^>]+>/g, "").length > 80 ? "…" : "")
                                : "")}
                          </p>
                          <div className="ratings">
                            <div className="number">
                              {(instructor.avgRating ?? 0).toFixed(1)}
                            </div>
                            <i className="icon-star-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Empty state */}
              {!isLoading && !isFetching && instructors.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <i className="flaticon-user" style={{ fontSize: 64, color: "#ccc" }} />
                  <p style={{ marginTop: 16, color: "#888" }}>
                    No instructors found. Try a different search term.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <ul className="wg-pagination justify-center wow fadeInUp">
                  <li className={page <= 1 ? "disabled" : ""}>
                    <a
                      onClick={() => page > 1 && setPage((p) => p - 1)}
                      style={{ cursor: page <= 1 ? "default" : "pointer" }}
                      aria-label="Previous"
                    >
                      <i className="icon-arrow-left" />
                    </a>
                  </li>
                  {pageNumbers.map((p, idx) => (
                    <React.Fragment key={p}>
                      {idx > 0 && pageNumbers[idx - 1] !== p - 1 && (
                        <li>
                          <a style={{ cursor: "default" }}>...</a>
                        </li>
                      )}
                      <li className={p === page ? "active" : ""}>
                        <a onClick={() => setPage(p)} style={{ cursor: "pointer" }}>
                          {p}
                        </a>
                      </li>
                    </React.Fragment>
                  ))}
                  <li className={page >= totalPages ? "disabled" : ""}>
                    <a
                      onClick={() => page < totalPages && setPage((p) => p + 1)}
                      style={{ cursor: page >= totalPages ? "default" : "pointer" }}
                      aria-label="Next"
                    >
                      <i className="icon-arrow-right" />
                    </a>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes ins-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
