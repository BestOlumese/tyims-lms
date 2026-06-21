import { db } from "@/lib/db";
import { users, courses, enrollments } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import {
  Users,
  BookOpen,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PendingInstructors } from "@/components/admin/pending-instructors";

export default async function AdminOverview() {
  // Fetch stats on the server for instant loading
  const [userCount] = await db.select({ value: count() }).from(users);
  const [courseCount] = await db.select({ value: count() }).from(courses);
  const [enrollmentCount] = await db.select({ value: count() }).from(enrollments);
  
  const stats = {
    totalUsers: userCount?.value || 0,
    totalCourses: courseCount?.value || 0,
    totalEnrollments: enrollmentCount?.value || 0,
    totalRevenue: 0,
  };

  const metrics = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      change: "+12%",
      trend: "up" as "up" | "down" | "neutral",
      accent: "bg-blue-50 text-blue-600",
    },
    {
      label: "Total Courses",
      value: stats.totalCourses,
      icon: BookOpen,
      change: "+8%",
      trend: "up" as "up" | "down" | "neutral",
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Revenue",
      value: `₦${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      change: "+0%",
      trend: "neutral" as "up" | "down" | "neutral",
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Enrollments",
      value: stats.totalEnrollments,
      icon: Activity,
      change: "+5%",
      trend: "up" as "up" | "down" | "neutral",
      accent: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Platform performance and metrics at a glance.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-gray-200/20 transition-all duration-300 group"
          >
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
                  m.accent
                )}
              >
                <m.icon size={20} />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-lg",
                  m.trend === "up"
                    ? "text-emerald-600 bg-emerald-50"
                    : m.trend === "down"
                      ? "text-red-500 bg-red-50"
                      : "text-gray-400 bg-gray-50"
                )}
              >
                {m.trend === "up" && <ArrowUpRight size={14} />}
                {m.trend === "down" && <ArrowDownRight size={14} />}
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

      {/* Content row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Requests & Analytics */}
        <div className="lg:col-span-3 space-y-8">
          {/* Instructor Requests */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <ShieldCheck size={18} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Instructor Applications</h2>
              </div>
              <Link 
                href="/admin/instructor-requests" 
                className="group flex items-center gap-1.5 text-[13px] font-bold text-indigo-600 hover:text-indigo-700 transition-all"
              >
                See more
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <PendingInstructors limit={3} />
          </section>

          {/* Chart placeholder */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gray-50 text-gray-400">
                  <BarChart3 size={18} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  Revenue Analytics
                </h2>
              </div>
              <select className="text-[13px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>

            {/* Chart bars placeholder */}
            <div className="flex items-end gap-3 h-56 pt-4">
              {[35, 55, 40, 70, 50, 80, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                  <div
                    className="w-full bg-indigo-50 rounded-xl transition-all group-hover:bg-indigo-600 duration-300 relative"
                    style={{ height: `${h}%` }}
                  >
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        ₦{h * 100}
                     </div>
                  </div>
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-tighter">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-8">
          <div className="flex items-center gap-2 mb-8">
            <div className="p-2 rounded-lg bg-gray-50 text-gray-400">
              <Clock size={18} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Recent Activity
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                action: "Platform deployed",
                time: "Just now",
                dot: "bg-emerald-400 shadow-emerald-100",
              },
              {
                action: "Admin account created",
                time: "Today",
                dot: "bg-blue-400 shadow-blue-100",
              },
              {
                action: "Database schema synced",
                time: "Today",
                dot: "bg-violet-400 shadow-violet-100",
              },
              {
                action: "Seed data loaded",
                time: "Today",
                dot: "bg-amber-400 shadow-amber-100",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-lg ring-4 ring-white transition-transform group-hover:scale-125 duration-300",
                    item.dot
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">{item.action}</p>
                  <p className="text-[12px] text-gray-400 font-medium mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-50">
            <button className="w-full text-center text-[13px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
              View all activity logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
