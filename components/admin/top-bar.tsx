"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Search,
  User,
  Settings,
  LogOut,
  MoreHorizontal,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [notifOpen, setNotifOpen] = useState(false);
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
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 w-80 transition-all focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/20">
            <Search size={16} className="text-gray-400" />
            <input 
            type="text" 
            placeholder="Search everything..." 
            className="bg-transparent border-none outline-none text-[13px] w-full text-gray-700 placeholder:text-gray-400"
            />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative"
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 animate-in slide-in-from-top-2 duration-200 z-50">
              <div className="p-4 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Notifications</h3>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">4 New</span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-100 transition-colors">
                        <User size={16} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[13px] font-semibold text-gray-900 leading-tight">New Instructor joined</p>
                        <p className="text-[12px] text-gray-500 leading-tight">A new instructor has requested to join the platform.</p>
                        <p className="text-[11px] text-gray-400 font-medium">2 hours ago</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-2 p-3 text-[13px] font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border-t border-gray-50 flex items-center justify-center gap-2">
                See all notifications
                <MoreHorizontal size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
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
