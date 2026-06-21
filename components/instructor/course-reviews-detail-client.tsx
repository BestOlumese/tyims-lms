"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, Star, ArrowLeft, Filter, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const CourseReviewsDetailClient = ({ courseId }: { courseId: string }) => {
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const { data: reviews, isLoading } = useQuery(
    orpc.instructor.getCourseReviews.queryOptions({ input: { courseId } })
  );

  const { data: courses } = useQuery(
    orpc.instructor.getInstructorCoursesWithReviewStats.queryOptions()
  );

  const course = courses?.find(c => c.id === courseId);

  const filteredReviews = reviews
    ?.filter(review => ratingFilter === "all" || review.rating === ratingFilter)
    ?.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/instructor/reviews"
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all shadow-sm group"
        >
          <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {course ? course.title : "Course Reviews"}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-[13px] text-gray-500 font-medium">
              Detailed student feedback
            </p>
            {course && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                <Star className="text-amber-500 fill-amber-500" size={12} />
                <span className="text-[11px] font-bold text-amber-700">{course.averageRating.toFixed(1)} Average</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8 pb-6 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <Filter size={16} className="text-gray-400" />
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="bg-transparent text-[13px] font-bold text-gray-700 outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
            <ArrowUpDown size={16} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="bg-transparent text-[13px] font-bold text-gray-700 outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
            <p className="text-[13px] font-bold text-gray-900">Loading reviews...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Star size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No reviews found</h3>
            <p className="text-[13px] text-gray-500 font-medium mt-1">
              {ratingFilter !== "all" 
                ? `No students have left a ${ratingFilter}-star review yet.`
                : "Students haven't reviewed this course yet."}
            </p>
            {ratingFilter !== "all" && (
              <button 
                onClick={() => setRatingFilter("all")}
                className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-xl text-[12px] font-bold hover:bg-gray-800 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReviews.map((review) => (
              <div key={review.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {review.userImage ? (
                      <img src={review.userImage} alt={review.userName || ""} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[14px]">
                        {review.userName?.charAt(0).toUpperCase() || "S"}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900 text-[14px]">{review.userName || "Anonymous Student"}</p>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { addSuffix: true }) : "Unknown date"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={cn(
                          i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"
                        )}
                      />
                    ))}
                  </div>
                </div>
                {review.comment ? (
                  <p className="text-[14px] text-gray-700 leading-relaxed font-medium">
                    "{review.comment}"
                  </p>
                ) : (
                  <p className="text-[13px] text-gray-400 italic">No written feedback provided.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
