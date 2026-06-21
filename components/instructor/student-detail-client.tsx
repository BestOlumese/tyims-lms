"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, ArrowLeft, BookOpen, Star, Calendar } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

export const StudentDetailClient = ({ studentId }: { studentId: string }) => {
  const { data, isLoading } = useQuery(
    orpc.instructor.getStudentDetails.queryOptions({ input: { studentId } })
  );

  const { data: students } = useQuery(
    orpc.instructor.getInstructorStudents.queryOptions()
  );

  const student = students?.find(s => s.id === studentId);

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
        <p className="text-[13px] font-bold text-gray-900">Loading student details...</p>
      </div>
    );
  }

  const enrolledCourses = data?.enrolledCourses || [];
  const studentReviews = data?.studentReviews || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/instructor/enrollments"
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all shadow-sm group shrink-0"
          >
            <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          </Link>
          <div className="flex items-center gap-4">
            {student?.image ? (
              <img src={student.image} alt={student.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shrink-0">
                {student?.name?.charAt(0).toUpperCase() || "S"}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{student?.name || "Student"}</h1>
              <p className="text-[13px] text-gray-500 font-medium mt-0.5">{student?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enrolled Courses */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <BookOpen className="text-indigo-600" size={20} />
            <h2 className="text-lg font-bold text-gray-900">Enrolled Courses</h2>
            <span className="ml-auto bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              {enrolledCourses.length} Total
            </span>
          </div>

          {enrolledCourses.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
              <p className="text-[13px] font-medium text-gray-500">No courses found for this student.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {enrolledCourses.map((course) => (
                <div key={course.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                  <div>
                    <h3 className="text-[14px] font-bold text-gray-900">{course.title}</h3>
                    <div className="flex items-center gap-1 mt-1 text-gray-400">
                      <Calendar size={12} />
                      <span className="text-[11px] font-medium">
                        Enrolled {course.enrolledAt ? formatDistanceToNow(new Date(course.enrolledAt), { addSuffix: true }) : "recently"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reviews */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Star className="text-amber-500" size={20} />
            <h2 className="text-lg font-bold text-gray-900">Recent Reviews</h2>
            <span className="ml-auto bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              {studentReviews.length} Total
            </span>
          </div>

          {studentReviews.length === 0 ? (
            <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
              <p className="text-[13px] font-medium text-gray-500">This student hasn't left any reviews yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {studentReviews.map((review) => (
                <div key={review.id} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-[13px] font-bold text-gray-900 line-clamp-1 flex-1">{review.courseTitle}</h3>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={cn(
                            i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {review.comment && (
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed bg-gray-50 p-3 rounded-xl">
                      "{review.comment}"
                    </p>
                  )}
                  
                  <div className="text-[11px] text-gray-400 font-medium">
                    Posted {review.createdAt ? format(new Date(review.createdAt), "MMM d, yyyy") : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
