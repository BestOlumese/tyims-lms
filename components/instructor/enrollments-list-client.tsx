"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Search, Loader2, Users, ArrowRight, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/shared/skeletons";
import Image from "next/image";

export const EnrollmentsListClient = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "enrollments">("enrollments");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: students, isLoading } = useQuery(
    orpc.instructor.getInstructorStudents.queryOptions()
  );

  const filteredStudents = students
    ?.filter((student) =>
      student.name.toLowerCase().includes(search.toLowerCase()) || 
      student.email.toLowerCase().includes(search.toLowerCase())
    )
    ?.sort((a, b) => {
      if (sortBy === "enrollments") {
        return b.enrollmentCount - a.enrollmentCount;
      }
      return a.name.localeCompare(b.name);
    }) || [];

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Student Enrollments</h1>
          <p className="text-[13px] text-gray-500 font-medium mt-1">Manage and track students enrolled in your courses.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl w-full sm:w-auto">
            <ArrowUpDown size={16} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "enrollments")}
              className="bg-transparent text-[13px] font-bold text-gray-700 outline-none cursor-pointer appearance-none pr-4 w-full"
            >
              <option value="enrollments">Most Enrollments</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-700">Student</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-center">Enrolled Courses</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Users size={20} className="text-gray-400" />
                    </div>
                    <p className="text-[13px] font-bold text-gray-900">No students found</p>
                    <p className="text-[12px] text-gray-500 mt-1">We couldn't find any students matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.image ? (
                          <div className="relative w-10 h-10 rounded-full border border-gray-200 overflow-hidden">
                            <Image src={student.image} alt={student.name} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[14px] shrink-0">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900">{student.name}</p>
                          <p className="text-[11px] text-gray-500 font-medium">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[12px] border border-indigo-100">
                        {student.enrollmentCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/instructor/enrollments/${student.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        View Details <ArrowRight size={14} />
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
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} entries
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
