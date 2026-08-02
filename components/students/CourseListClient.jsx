"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { orpc } from "@/lib/orpc";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { formatPrice } from "@/lib/formatPrice";
import { useCart } from "@/lib/cart-context";

function flatCategories(nodes = []) {
  return nodes.flatMap(({ subItems = [], ...cat }) => [cat, ...flatCategories(subItems)]);
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price (Low to High)" },
  { value: "price_desc", label: "Price (High to Low)" },
];

/**
 * @typedef {{ total: number, page: number, pageSize: number, data: any[] }} CourseListPage
 *
 * @param {{
 *   initialCategoryId?: string | null,
 *   initialData?: CourseListPage | null,
 *   initialQ?: string,
 *   hideCategoryFilter?: boolean,
 * }} [props]
 */
export default function CourseListClient({
  initialCategoryId = null,
  initialData = null,
  initialQ = "",
  hideCategoryFilter = false,
} = {}) {
  const { addItem, isInCart } = useCart();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState(initialQ || "");
  const [debouncedQ, setDebouncedQ] = useState(initialQ || "");
  const [pageSize] = useState(12);
  const [categoryIds, setCategoryIds] = useState(
    initialCategoryId ? [String(initialCategoryId)] : []
  );
  const [priceFilter, setPriceFilter] = useState("");
  const [sort, setSort] = useState("newest");

  const sortRef = useRef(null);

  // Sync search state when navigating to /courses?q=term from within the page
  useEffect(() => {
    setQ(initialQ || "");
    setDebouncedQ(initialQ || "");
  }, [initialQ]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, categoryIds, priceFilter, sort]);

  // ── Nice-select init for Category / Price filter dropdowns ─────────────────
  useEffect(() => {
    const dropdowns = document.querySelectorAll(".group-filter .nice-select");

    const toggleDropdown = (event) => {
      const dropdown = event.currentTarget.closest(".nice-select");
      dropdowns.forEach((d) => {
        if (d !== dropdown) d.classList.remove("open");
      });
      dropdown.classList.toggle("open");
    };

    const handleOutside = (event) => {
      dropdowns.forEach((d) => {
        if (!d.contains(event.target)) d.classList.remove("open");
      });
    };

    dropdowns.forEach((d) =>
      d.querySelector(".current")?.addEventListener("click", toggleDropdown)
    );
    document.addEventListener("click", handleOutside);

    return () => {
      dropdowns.forEach((d) =>
        d.querySelector(".current")?.removeEventListener("click", toggleDropdown)
      );
      document.removeEventListener("click", handleOutside);
    };
  }, []);

  // ── Sort dropdown (standalone ref-based) ──────────────────────────────────
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

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: categoriesTree } = useQuery({
    ...orpc.getPublicCategories.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const allCategories = flatCategories(categoriesTree || []);

  const input = {
    page,
    pageSize,
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(categoryIds.length > 0 ? { categoryIds } : {}),
    ...(priceFilter ? { priceFilter } : {}),
    sort,
  };

  // initialData is only valid when active filters exactly match what was fetched server-side
  const initialDataMatches =
    initialData &&
    ((!initialCategoryId && categoryIds.length === 0) ||
      (initialCategoryId &&
        categoryIds.length === 1 &&
        categoryIds[0] === String(initialCategoryId))) &&
    !debouncedQ &&
    priceFilter === "" &&
    sort === "newest" &&
    page === 1;

  const { data, isLoading, isFetching } = useQuery({
    ...orpc.getPublicCourses.queryOptions({ input }),
    placeholderData: keepPreviousData,
    ...(initialDataMatches ? { initialData } : {}),
  });

  const courseList = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);

  const selectedSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || "Newest";

  // Category display label (uses flat list to find subcategory names too)
  const categoryLabel =
    categoryIds.length === 0
      ? "Categories"
      : categoryIds.length === 1
      ? allCategories.find((c) => String(c.id) === categoryIds[0])?.name || "1 Selected"
      : `${categoryIds.length} Selected`;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleCategory = useCallback((id) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }, []);

  const selectPrice = useCallback((val) => {
    setPriceFilter(val);
    document.querySelectorAll(".group-filter .nice-select").forEach((d) =>
      d.classList.remove("open")
    );
  }, []);

  const selectSort = useCallback((val) => {
    setSort(val);
    sortRef.current?.classList.remove("open");
  }, []);

  const clearAll = useCallback(() => {
    setCategoryIds(initialCategoryId ? [String(initialCategoryId)] : []);
    setPriceFilter("");
    setSort("newest");
    setQ("");
    setPage(1);
  }, [initialCategoryId]);

  // Pagination page numbers with ellipsis
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
      <div className="tf-container">
        <div className="row">
          <div className="col-12">
            <div className="tf-spacing-1">

              {/* ── Top filter bar ─────────────────────────────────────────── */}
              <div className="top-wrapper">
                <form onSubmit={(e) => e.preventDefault()} className="group-filter">

                  {/* All Filter button → offcanvas */}
                  <div className="wg-filter wow fadeInUp">
                    <div
                      className="tf-btn active btn-filter"
                      data-bs-toggle="offcanvas"
                      data-bs-target="#courseFilterOffcanvas"
                      aria-controls="courseFilterOffcanvas"
                      style={{ cursor: "pointer" }}
                    >
                      <i className="flaticon-setting" />
                      All Filter
                    </div>
                  </div>

                  {/* Category nice-select — hidden on category page */}
                  {!hideCategoryFilter && (
                    <div className="nice-select wow fadeInUp">
                      <span className="current">
                        {categoryLabel}
                        <i className="icon icon-triangular-down" />
                      </span>
                      <ul className="list style-radio">
                        <li className="checkbox-item fl-item2">
                          <label>
                            <p>All Categories</p>
                            <input
                              readOnly
                              type="checkbox"
                              checked={categoryIds.length === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryIds([]);
                              }}
                            />
                            <span className="btn-checkbox" />
                          </label>
                        </li>
                        {(categoriesTree || []).map((cat) => (
                          <li key={cat.id} className="checkbox-item fl-item2">
                            <label>
                              <p>{cat.name}</p>
                              <input
                                readOnly
                                type="checkbox"
                                checked={categoryIds.includes(String(cat.id))}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCategory(String(cat.id));
                                }}
                              />
                              <span className="btn-checkbox" />
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Price nice-select */}
                  <div className="nice-select wow fadeInUp">
                    <span className="current">
                      {priceFilter === "free" ? "Free" : priceFilter === "paid" ? "Paid" : "Price"}
                      <i className="icon icon-triangular-down" />
                    </span>
                    <ul className="list style-radio">
                      {[
                        { value: "", label: "All" },
                        { value: "free", label: "Free" },
                        { value: "paid", label: "Paid" },
                      ].map(({ value, label }) => (
                        <li key={label} className="checkbox-item">
                          <label>
                            <p>{label}</p>
                            <input
                              readOnly
                              type="radio"
                              checked={priceFilter === value}
                              onClick={(e) => {
                                e.stopPropagation();
                                selectPrice(value);
                              }}
                            />
                            <span className="btn-checkbox" />
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Search */}
                  <div className="wg-filter wow fadeInUp" style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="style-1"
                      placeholder="Search courses..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </form>

                {/* Results count + Sort */}
                <div className="sort-by-wrap mt-0 wow">
                  <div className="sort-wrap">
                    <p className="text text-1 wow fadeInUp" data-wow-delay="0.1s">
                      {isLoading ? (
                        "Loading..."
                      ) : total > 0 ? (
                        <>Showing {start}–{end} of {total} Courses{isFetching && <span style={{ marginLeft: 6, opacity: 0.6 }}>•••</span>}</>
                      ) : (
                        "No courses found"
                      )}
                    </p>
                    <div className="sort-by">
                      <p className="text text-2 wow fadeInUp" data-wow-delay="0.1s">Sort by</p>
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

              {/* ── Course grid ─────────────────────────────────────────────── */}
              <div style={{ position: "relative" }}>
                {isFetching && courseList.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(255,255,255,0.55)",
                      zIndex: 5,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      paddingTop: 40,
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
                            background: "#5f4def",
                            animation: "pulse 1.2s ease-in-out infinite",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid-list-items-4">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="course-item hover-img h240">
                        <div
                          className="features image-wrap"
                          style={{ background: "#f0f0f0", height: "100%" }}
                        />
                        <div className="content">
                          <div style={{ height: 16, background: "#f0f0f0", borderRadius: 4, marginBottom: 8, width: "60%" }} />
                          <div style={{ height: 20, background: "#f0f0f0", borderRadius: 4, marginBottom: 8 }} />
                          <div style={{ height: 20, background: "#f0f0f0", borderRadius: 4, width: "80%" }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    courseList.map((course) => (
                      <div
                        key={course.id}
                        className="course-item hover-img h240 wow fadeInUp"
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        <div className="features image-wrap">
                          {course.thumbnailUrl ? (
                            <img
                              className="lazyload"
                              alt={course.title}
                              src={course.thumbnailUrl}
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
                        <div
                          className="content"
                          style={{ flex: 1, display: "flex", flexDirection: "column" }}
                        >
                          <div className="meta">
                            {course.categoryName && (
                              <div className="meta-item">
                                <i className="flaticon-book" />
                                <p>{course.categoryName}</p>
                              </div>
                            )}
                          </div>
                          <h5 className="fw-5 line-clamp-2">
                            <Link href={`/courses/${course.id}`}>{course.title}</Link>
                          </h5>
                          {course.instructorName && (
                            <div className="author">
                              By: <span>{course.instructorName}</span>
                            </div>
                          )}
                          <div className="bottom" style={{ marginTop: "auto" }}>
                            <div className="h5 price fw-5">
                              {formatPrice(course.price)}
                            </div>
                            {isInCart(course.id) ? (
                              <Link href="/cart" className="tf-btn-arrow">
                                <span className="fw-5">View Cart</span>
                                <i className="icon-shopcart" />
                              </Link>
                            ) : (
                              <button
                                className="tf-btn-arrow"
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                onClick={() =>
                                  addItem({
                                    courseId: course.id,
                                    title: course.title,
                                    price: course.price ?? 0,
                                    discountPrice: course.discountPrice ?? 0,
                                    thumbnailUrl: course.thumbnailUrl ?? null,
                                    instructorName: course.instructorName ?? "",
                                  })
                                }
                              >
                                <span className="fw-5">Add to Cart</span>
                                <i className="icon-shopcart" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Empty state */}
              {!isLoading && !isFetching && courseList.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <i className="flaticon-online-training" style={{ fontSize: 64, color: "#ccc" }} />
                  <p style={{ marginTop: 16, color: "#888" }}>
                    No courses found. Try adjusting your filters.
                  </p>
                </div>
              )}

              {/* ── Pagination ──────────────────────────────────────────────── */}
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
                        <a
                          onClick={() => setPage(p)}
                          style={{ cursor: "pointer" }}
                        >
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
      </div>

      {/* ── Filter offcanvas (All Filter drawer) ───────────────────────────── */}
      <div
        className="tf-sidebar filter offcanvas offcanvas-start"
        tabIndex={-1}
        id="courseFilterOffcanvas"
        aria-labelledby="courseFilterOffcanvasLabel"
      >
        <div className="widget heading-title">
          <h5 id="courseFilterOffcanvasLabel">All Filter</h5>
          <i
            className="flaticon-close-1 btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
            style={{ cursor: "pointer" }}
          />
        </div>
        <div className="offcanvas-body overflow-y-auto">

          {/* Categories — multi-select, hidden on category page */}
          {!hideCategoryFilter && (
            <div className="sidebar-item widget wg-categorie tf-collapse-item">
              <div className="sidebar-title tf-collapse-title" style={{ cursor: "pointer" }}>
                <h5 className="fw-5">Categories</h5>
                <i className="tf-collapse-icon icon-arrow-top" />
              </div>
              <ul className="tf-collapse-content">
                <li className="checkbox-item fl-item2">
                  <label>
                    <p>All Categories</p>
                    <input
                      readOnly
                      type="checkbox"
                      checked={categoryIds.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryIds([]);
                      }}
                    />
                    <span className="btn-checkbox" />
                  </label>
                </li>
                {allCategories.map((cat) => (
                  <li key={cat.id} className="checkbox-item fl-item2">
                    <label>
                      <p>{cat.name}</p>
                      <input
                        readOnly
                        type="checkbox"
                        checked={categoryIds.includes(String(cat.id))}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategory(String(cat.id));
                        }}
                      />
                      <span className="btn-checkbox" />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Price */}
          <div className="sidebar-item widget wg-categorie tf-collapse-item">
            <div className="sidebar-title tf-collapse-title" style={{ cursor: "pointer" }}>
              <h5 className="fw-5">Price</h5>
              <i className="tf-collapse-icon icon-arrow-top" />
            </div>
            <ul className="tf-collapse-content">
              {[
                { value: "", label: "All" },
                { value: "free", label: "Free" },
                { value: "paid", label: "Paid" },
              ].map(({ value, label }) => (
                <li key={label} className="checkbox-item">
                  <label>
                    <p>{label}</p>
                    <input
                      readOnly
                      type="radio"
                      checked={priceFilter === value}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectPrice(value);
                      }}
                    />
                    <span className="btn-checkbox" />
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Sort */}
          <div className="sidebar-item widget wg-categorie tf-collapse-item">
            <div className="sidebar-title tf-collapse-title" style={{ cursor: "pointer" }}>
              <h5 className="fw-5">Sort By</h5>
              <i className="tf-collapse-icon icon-arrow-top" />
            </div>
            <ul className="tf-collapse-content">
              {SORT_OPTIONS.map(({ value, label }) => (
                <li key={value} className="checkbox-item">
                  <label>
                    <p>{label}</p>
                    <input
                      readOnly
                      type="radio"
                      checked={sort === value}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectSort(value);
                      }}
                    />
                    <span className="btn-radio" />
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="tf-btn"
            onClick={clearAll}
            data-bs-dismiss="offcanvas"
          >
            Clear Filter
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </>
  );
}
