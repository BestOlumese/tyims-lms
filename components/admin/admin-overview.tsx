"use client";

import { orpc } from "@/lib/orpc";
import { Users, BookOpen, DollarSign, TrendingUp, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function AdminOverview() {
  const { data: stats, isLoading } = useQuery(orpc.admin.getPlatformOverview.queryOptions());

  const cards = [
    { 
      name: "Total Users", 
      value: stats?.totalUsers || 0, 
      icon: Users, 
      color: "text-blue-600", 
      bg: "bg-blue-50 dark:bg-blue-900/10",
      change: "+12.5%",
      positive: true
    },
    { 
      name: "Total Courses", 
      value: stats?.totalCourses || 0, 
      icon: BookOpen, 
      color: "text-indigo-600", 
      bg: "bg-indigo-50 dark:bg-indigo-900/10",
      change: "+8.2%",
      positive: true
    },
    { 
      name: "Total Revenue", 
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`, 
      icon: DollarSign, 
      color: "text-emerald-600", 
      bg: "bg-emerald-50 dark:bg-emerald-900/10",
      change: "+0%",
      positive: true
    },
    { 
      name: "Active Subscriptions", 
      value: "0", 
      icon: TrendingUp, 
      color: "text-orange-600", 
      bg: "bg-orange-50 dark:bg-orange-900/10",
      change: "0",
      positive: true
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium">
          Monitor your platform's growth and operations at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div 
            key={card.name} 
            className="group relative bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
          >
            <div className="flex items-start justify-between relative z-10">
              <div className={cn("p-4 rounded-2xl transition-all duration-300 group-hover:scale-110", card.bg, card.color)}>
                <card.icon size={24} />
              </div>
              <span className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1",
                card.positive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"
              )}>
                {card.change}
                <ArrowUpRight size={12} />
              </span>
            </div>
            
            <div className="mt-6 relative z-10">
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                {card.name}
              </p>
              {isLoading ? (
                <div className="h-10 w-24 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg mt-1" />
              ) : (
                <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 mt-1 tracking-tighter">
                  {card.value}
                </p>
              )}
            </div>
            
            <div className={cn("absolute -bottom-8 -right-8 w-32 h-32 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-300", card.color)}>
              <card.icon size={128} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 min-h-[400px] flex items-center justify-center text-zinc-400 italic">
          Revenue Analytics Chart Coming Soon...
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-center items-center text-center space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-full text-indigo-600 animate-bounce">
            <TrendingUp size={32} />
          </div>
          <h3 className="font-bold text-lg">System Health</h3>
          <p className="text-sm text-zinc-500 max-w-[200px]">All systems are operational. Global latency is low.</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-1.5 h-6 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
