"use client";

import Link from "next/link";
import React from "react";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export default function Categories() {
  const { data: categories } = useQuery({
    ...orpc.getPublicCategories.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  if (!categories || categories.length === 0) {
    return (
      <ul>
        <li className="item title">COURSE CATEGORIES</li>
      </ul>
    );
  }

  return (
    <ul>
      <li className="item title">COURSE CATEGORIES</li>
      {categories.map((elm, i) => (
        <li key={elm.id || i} className={elm.subItems?.length ? "has-children" : ""}>
          <Link className="item" href={`/category/${elm.slug || elm.id}`}>
            {elm.name || elm.title}
          </Link>
          {elm.subItems?.length > 0 && (
            <ul className="sub-menu">
              <li className="item title">Sub-categories</li>
              {elm.subItems.map((elm2, i2) => (
                <li key={elm2.id || i2}>
                  <Link className="item" href={`/category/${elm2.slug || elm2.id}`}>
                    {elm2.name || elm2.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
