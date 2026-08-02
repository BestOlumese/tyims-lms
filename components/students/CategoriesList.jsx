"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";

// The template's card reserves the left edge for an image; our DB categories have none,
// so pad the content block to keep the card balanced.
const CONTENT_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "20px 24px",
  width: "100%",
};

/**
 * NOTE: this renders inside the (student) template shell, where Tailwind is NOT loaded
 * (Tailwind is only imported by app/(dashboards)/dashboard.css). This component used to
 * use Tailwind classes (grid-cols-*, gap-6, text-zinc-500, rounded-xl) which resolved to
 * nothing here and rendered as an unstyled stack. It now uses Bootstrap's grid plus the
 * Upskill template's own `categories-item` card, both of which are present on this route.
 */
export default function CategoriesList() {
  const {
    data: categories,
    isLoading,
    isError,
  } = useQuery(orpc.getPublicCategories.queryOptions());

  if (isLoading) {
    return (
      <div className="tf-container">
        <div className="row">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="col-sm-6 col-lg-4" key={i}>
              <div className="categories-item categories-item-default">
                <div className="categories-item-content" style={CONTENT_STYLE}>
                  <span className="placeholder-glow">
                    <span className="placeholder col-7" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="tf-container">
        <p className="text-center">
          We couldn&apos;t load categories right now. Please refresh the page.
        </p>
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="tf-container">
        <p className="text-center">No categories found.</p>
      </div>
    );
  }

  return (
    <div className="tf-container">
      <div className="row">
        {categories.map((c) => {
          const subCount = (c.subItems || []).length;
          return (
            <div className="col-sm-6 col-lg-4" key={c.id}>
              <Link
                href={`/category/${c.slug}`}
                className="categories-item categories-item-default"
              >
                <div className="categories-item-content" style={CONTENT_STYLE}>
                  <span className="text">{c.name}</span>
                  <span className="body-2">
                    {subCount} {subCount === 1 ? "subcategory" : "subcategories"}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
