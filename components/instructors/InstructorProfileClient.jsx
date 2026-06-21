"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";

export default function InstructorProfileClient({ id }) {
  const { data, isLoading } = useQuery(orpc.getPublicInstructor.queryOptions({ input: { id } }));

  if (isLoading) return <div className="p-8">Loading instructor...</div>;
  if (!data) return <div className="p-8">Instructor not found.</div>;

  const { instructor, courses } = data;

  return (
    <div className="tf-container py-12">
      <div className="flex gap-6 items-center">
        <img src={instructor.image || '/images/avatar-placeholder.png'} className="w-28 h-28 rounded-full" />
        <div>
          <h2 className="text-2xl font-bold">{instructor.name}</h2>
          <p className="text-zinc-600">{instructor.bio}</p>
        </div>
      </div>

      <h3 className="text-xl font-bold mt-8 mb-4">Courses by {instructor.name}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((c) => (
          <div key={c.id} className="border rounded-xl p-4">
            <h4 className="font-bold"><Link href={`/course/${c.id}`}>{c.title}</Link></h4>
            <div className="text-sm text-zinc-500">${c.price?.toFixed?.(2) ?? 'Free'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
