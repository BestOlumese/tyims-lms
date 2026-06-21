"use client";

import { useState, useMemo } from "react";
import { orpc } from "@/lib/orpc";
import { 
  Search, 
  PlusCircle, 
  BookOpen, 
  Edit2, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  FileText,
  ExternalLink,
  MoreVertical,
  Trash2,
  Eye,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TableSkeleton } from "@/components/shared/skeletons";
import Image from "next/image";

interface MyCoursesClientProps {
  initialData?: any[];
}

export default function MyCoursesClient({ initialData }: MyCoursesClientProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: courses, isLoading } = useQuery({
    ...orpc.instructor.getMyCourses.queryOptions(),
    initialData
  });

  const processedCourses = useMemo(() => {
    if (!courses) return [];
    return courses.filter((c: any) => 
      c.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [courses, search]);

  const totalPages = Math.ceil(processedCourses.length / itemsPerPage);
  const paginatedCourses = processedCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Courses</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and edit your teaching content.</p>
        </div>
        <Link 
          href="/instructor/courses/new"
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
        >
          <PlusCircle size={18} />
          Create New Course
        </Link>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/5">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search your courses..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/20 focus:bg-white transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
           <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest px-2">
            {processedCourses.length} Courses
          </p>
        </div>
      </div>

      {/* Courses List */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-700">Course</th>
                    <th className="px-6 py-4 font-bold text-gray-700">Status</th>
                    <th className="px-6 py-4 font-bold text-gray-700">Price</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-right">Last Updated</th>
                    <th className="px-6 py-4 font-bold text-gray-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedCourses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                          <BookOpen size={32} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No courses yet</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Start your journey as an instructor by creating your first course.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCourses.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {c.imageUrl ? (
                              <div className="relative w-12 h-10 rounded-lg border border-gray-200 overflow-hidden shrink-0">
                                <Image src={c.imageUrl} alt={c.title} fill className="object-cover" />
                              </div>
                            ) : (
                              <div className="w-12 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                <BookOpen size={18} className="text-indigo-400" />
                              </div>
                            )}
                            <div className="font-bold text-gray-900">{c.title}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                            c.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                          )}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-600">${c.price || 0}</td>
                        <td className="px-6 py-4 text-right text-gray-500">
                          {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/instructor/courses/${c.id}`} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                              <Edit2 size={16} className="text-gray-600" />
                            </Link>
                            <Link href={`/courses/${c.id}`} target="_blank" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                              <ExternalLink size={16} className="text-gray-600" />
                            </Link>
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
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, processedCourses.length)} of {processedCourses.length} entries
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
}
