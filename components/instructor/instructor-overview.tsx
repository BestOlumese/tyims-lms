"use client";

import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  BookOpen, 
  DollarSign, 
  Activity, 
  ArrowUpRight, 
  BarChart3,
  Clock,
  ArrowRight,
  PlusCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface InstructorOverviewProps {
  initialData?: {
    totalCourses: number;
    totalStudents: number;
    totalRevenue: number;
  };
}

export default function InstructorOverview({ initialData }: InstructorOverviewProps) {
  const { data: stats, isLoading } = useQuery({
    ...orpc.instructor.getOverview.queryOptions(),
    initialData
  });

  if (isLoading && !stats) return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-3">
        <div className="h-8 bg-gray-100 rounded-lg w-48" />
        <div className="h-4 bg-gray-100 rounded-lg w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );

  const metrics = [
    {
      label: "Total Students",
      value: stats?.totalStudents || 0,
      icon: Users,
      change: "+4%",
      trend: "up" as const,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "My Courses",
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      change: "+2",
      trend: "up" as const,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Total Earnings",
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      change: "+12%",
      trend: "up" as const,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Avg. Rating",
      value: "4.8",
      icon: Activity,
      change: "+0.2",
      trend: "up" as const,
      accent: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back!</h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening with your courses today.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-gray-200/20 transition-all duration-300 group"
          >
            <div className="flex items-center justify-between">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-sm",
                m.accent
              )}>
                <m.icon size={20} />
              </div>
              <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600">
                <ArrowUpRight size={14} />
                {m.change}
              </span>
            </div>
            <div className="mt-5">
              <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">
                {m.label}
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums tracking-tight">
                {m.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Course Performance Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        <BarChart3 size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Revenue Growth</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">This Week</span>
                    </div>
                </div>
            </div>
            
            <div className="h-64 flex items-end gap-3 pt-4">
                {[40, 70, 45, 90, 65, 85, 55].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                        <div className="w-full relative h-full flex items-end">
                             <div 
                                className="w-full bg-indigo-50 rounded-xl transition-all duration-500 group-hover:bg-indigo-600 relative" 
                                style={{ height: `${h}%` }} 
                             >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    ₦{(h * 1250).toLocaleString()}
                                </div>
                             </div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        {/* Right Sidebar Section */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden group shadow-xl shadow-gray-200/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-600/40 transition-colors duration-500" />
                <h3 className="text-xl font-bold relative z-10 leading-tight">Create a new course</h3>
                <p className="text-gray-400 text-sm mt-2 relative z-10 font-medium">Share your expertise with thousands of students.</p>
                <Link 
                    href="/instructor/courses/new"
                    className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 active:scale-[0.98] relative z-10 text-[13px]"
                >
                    <PlusCircle size={18} />
                    Get Started
                    <ArrowRight size={18} className="ml-1" />
                </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm flex-1">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 rounded-lg bg-gray-50 text-gray-400">
                        <Clock size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                </div>
                <div className="space-y-6 py-4">
                    <p className="text-[13px] text-gray-400 font-medium text-center italic">No recent activity to show.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
