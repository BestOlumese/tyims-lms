"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";

export default function CategoriesList() {
  const { data: categories, isLoading } = useQuery(orpc.getPublicCategories.queryOptions());

  if (isLoading) return <div className="p-8">Loading categories...</div>;
  if (!categories || categories.length === 0) return <div className="p-8">No categories found.</div>;

  return (
    <div className="tf-container py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((c) => (
          <Link key={c.id} href={`/category/${c.slug}`} className="block border rounded-xl p-6 hover:shadow">
            <h3 className="text-lg font-bold mb-2">{c.name}</h3>
            <p className="text-sm text-zinc-500">{(c.subItems || []).length} subcategories</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
