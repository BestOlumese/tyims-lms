"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, ArrowLeft, ArrowUpDown, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/shared/skeletons";
import Image from "next/image";

export const QuizDetailsClient = ({ courseId, quizId }: { courseId: string; quizId: string }) => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"latest" | "highest" | "lowest">("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data, isLoading } = useQuery(
    orpc.instructor.getQuizAttempts.queryOptions({ input: { quizId } })
  );

  const attempts = data?.attempts || [];
  const passingScore = data?.passingScore;

  const filteredAttempts = attempts
    .filter(a => a.studentName?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "highest") return b.score - a.score;
      if (sortBy === "lowest") return a.score - b.score;
      // latest
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
    });

  const totalPages = Math.ceil(filteredAttempts.length / itemsPerPage);
  const paginatedAttempts = filteredAttempts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href={`/instructor/assessments/${courseId}`}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all shadow-sm group shrink-0"
          >
            <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quiz Attempts</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[13px] text-gray-500 font-medium">Review student submissions and scores.</p>
              {passingScore !== null && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-700 font-bold text-[10px] uppercase tracking-wider">
                  Passing Score: {passingScore}%
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl w-full sm:w-auto">
            <ArrowUpDown size={16} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "latest" | "highest" | "lowest")}
              className="bg-transparent text-[13px] font-bold text-gray-700 outline-none cursor-pointer appearance-none pr-4 w-full"
            >
              <option value="latest">Latest Attempts</option>
              <option value="highest">Highest Score</option>
              <option value="lowest">Lowest Score</option>
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
          <TableSkeleton rows={5} columns={4} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-700">Student</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-center">Score</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-center">Status</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-right">Attempt Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedAttempts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <UserIcon size={20} className="text-gray-400" />
                    </div>
                    <p className="text-[13px] font-bold text-gray-900">No attempts found</p>
                    <p className="text-[12px] text-gray-500 mt-1">No students match your criteria.</p>
                  </td>
                </tr>
              ) : (
                paginatedAttempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {attempt.studentImage ? (
                          <div className="relative w-8 h-8 rounded-full border border-gray-200 overflow-hidden shrink-0">
                            <Image src={attempt.studentImage} alt={attempt.studentName || "Student"} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[12px] shrink-0">
                            {attempt.studentName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <p className="font-bold text-gray-900">{attempt.studentName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-900 text-[14px]">
                        {attempt.score}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {attempt.passed === true && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-100">
                          PASSED
                        </span>
                      )}
                      {attempt.passed === false && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-100">
                          FAILED
                        </span>
                      )}
                      {attempt.passed === null && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 font-medium text-[11px]">
                          NO CRITERIA
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-gray-900">
                          {attempt.submittedAt ? format(new Date(attempt.submittedAt), "MMM d, yyyy") : "Unknown"}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {attempt.submittedAt ? formatDistanceToNow(new Date(attempt.submittedAt), { addSuffix: true }) : ""}
                        </span>
                      </div>
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
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAttempts.length)} of {filteredAttempts.length} entries
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
