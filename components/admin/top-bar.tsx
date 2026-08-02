"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Settings,
  LogOut,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/shared/notification-bell";
import { DashboardSearch } from "@/components/shared/dashboard-search";

interface TopBarProps {
  title?: string;
  roleLabel?: string;
  settingsHref?: string;
  user?: {
    name: string;
    email: string;
    image?: string | null;
  };
  onLogout: () => void;
}

export const TopBar = ({ title, roleLabel = "Account", settingsHref = "/admin/settings", user, onLogout }: TopBarProps) => {
  const [profileOpen, setProfileOpen] = useState(false);

  if (!user) return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm shadow-gray-900/5 animate-pulse">
        <div className="h-4 bg-gray-100 w-32 rounded" />
        <div className="h-9 w-9 bg-gray-100 rounded-xl" />
    </header>
  );

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm shadow-gray-900/5">
      {/* Title / Search Section */}
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-[15px] font-bold text-gray-900 pr-4 border-r border-gray-100 hidden lg:block">
            {title}
          </h1>
        )}
        {/* Real search. This input previously had no handler at all. */}
        <DashboardSearch />
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications — real, DB-backed. This block previously rendered three
            hardcoded "New Instructor joined" entries and a fake "4 New" badge to
            every user regardless of what had actually happened. */}
        <NotificationBell />

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 p-1.5 pr-3 hover:bg-gray-50 rounded-2xl transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-[14px] shadow-lg shadow-indigo-100 overflow-hidden">
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[13px] font-bold text-gray-900 leading-none">{user.name}</p>
              <p className="text-[11px] font-medium text-gray-400 leading-none mt-1">{roleLabel}</p>
            </div>
            <ChevronDown size={14} className={cn("text-gray-400 transition-transform duration-200", profileOpen && "rotate-180")} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 animate-in slide-in-from-top-2 duration-200 z-50">
              <div className="p-4 border-b border-gray-50 sm:hidden">
                <p className="text-[13px] font-bold text-gray-900 leading-none">{user.name}</p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">{user.email}</p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all group"
                  onClick={() => setProfileOpen(false)}
                >
                  <Globe size={18} className="text-gray-400 group-hover:text-indigo-600" />
                  View Site
                </Link>
                <Link
                  href={settingsHref}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all group"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings size={18} className="text-gray-400 group-hover:text-indigo-600" />
                  Account Settings
                </Link>
                <div className="h-px bg-gray-50 my-2" />
                <button 
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all group"
                >
                  <LogOut size={18} className="text-red-400 group-hover:text-red-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
