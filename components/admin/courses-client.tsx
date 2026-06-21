"use client";

import { useState, useMemo } from "react";
import { orpc } from "@/lib/orpc";
import { 
  Search, 
  Trash2, 
  BookOpen, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/shared/confirm-modal";

interface CoursesClientProps {
  initialData?: any[];
}

export default function CoursesClient({ initialData }: CoursesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<any>(null);

  const { data: courses, isLoading, refetch } = useQuery({
    ...orpc.admin.getCourses.queryOptions(),
    initialData
  });

  const deleteMutation = useMutation(orpc.admin.deleteCourse.mutationOptions());

  const handleDelete = async () => {
    if (!deleteCourse) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteCourse.id });
      toast.success("Course deleted successfully");
      setDeleteCourse(null);
      refetch();
    } catch (error) {
      toast.error("Failed to delete course");
    }
  };

  const processedCourses = useMemo(() => {
    if (!courses) return [];
    
    let filtered = courses.filter((c: any) => {
      const matchesSearch = 
        c.title.toLowerCase().includes(search.toLowerCase()) || 
        c.instructorName?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = !statusFilter || c.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    if (sortConfig) {
      filtered.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [courses, search, statusFilter, sortConfig]);

  const totalPages = Math.ceil(processedCourses.length / itemsPerPage);
  const paginatedCourses = processedCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Course Management</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage all courses across the platform.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by title or instructor..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={statusFilter || ""}
            onChange={(e) => {
              setStatusFilter(e.target.value || undefined);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-semibold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <div className="h-4 w-px bg-gray-100 mx-1" />
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest px-2 whitespace-nowrap">
            {processedCourses.length} Total
          </p>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('title')}>
                  <div className="flex items-center gap-2">
                    Course
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Instructor</th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Price</th>
                <th className="px-6 py-4 text-right text-[12px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && !courses ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4"><div className="h-10 bg-gray-50 rounded-xl w-full" /></td>
                  </tr>
                ))
              ) : paginatedCourses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <BookOpen size={32} className="text-gray-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-900 font-bold">No courses found</p>
                        <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-[14px] shadow-sm shrink-0">
                          <BookOpen size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-gray-900 truncate">{c.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-gray-400">
                            <Clock size={12} />
                            <p className="text-[12px] font-medium truncate">
                              {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-bold text-gray-700">{c.instructorName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-medium text-gray-500">{c.categoryName || "Uncategorized"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border",
                        c.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        c.status === "DRAFT" ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-gray-50 text-gray-600 border-gray-100"
                      )}>
                        {c.status === "PUBLISHED" && <CheckCircle2 size={12} />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[14px] font-bold text-gray-900">
                        {c.price === 0 ? "Free" : `₦${c.price.toLocaleString()}`}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setDeleteCourse(c)}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete Course"
                        >
                          <Trash2 size={18} />
                        </button>
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
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[12px] font-bold text-gray-400">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, processedCourses.length)} to {Math.min(currentPage * itemsPerPage, processedCourses.length)} of {processedCourses.length} courses
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!deleteCourse}
        onClose={() => setDeleteCourse(null)}
        onConfirm={handleDelete}
        title="Delete Course"
        description="Are you sure you want to delete this course? This action cannot be undone and will remove all lessons and enrollments associated with it."
        confirmationText={deleteCourse?.title}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
