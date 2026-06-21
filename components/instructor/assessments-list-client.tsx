"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Search, Loader2, CheckSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { TableSkeleton } from "@/components/shared/skeletons";

export const AssessmentsListClient = () => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: courses, isLoading } = useQuery(
    orpc.instructor.getInstructorAssessmentsStats.queryOptions()
  );

  const filteredCourses = courses?.filter((course) =>
    course.title.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Assessments</h1>
          <p className="text-[13px] text-gray-500 font-medium mt-1">Manage quizzes and view student attempts across your courses.</p>
        </div>
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-64 pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-700">Course</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-center">Total Quizzes</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-center">Student Attempts</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedCourses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <CheckSquare size={20} className="text-gray-400" />
                    </div>
                    <p className="text-[13px] font-bold text-gray-900">No courses with quizzes found</p>
                    <p className="text-[12px] text-gray-500 mt-1">You haven't created any quizzes in your courses yet.</p>
                  </td>
                </tr>
              ) : (
                paginatedCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{course.title}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11px]">
                        {course.quizCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-100">
                        {course.submissionsCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/instructor/assessments/${course.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        View Quizzes <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-[12px] text-gray-500 font-medium">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredCourses.length)} of {filteredCourses.length} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
