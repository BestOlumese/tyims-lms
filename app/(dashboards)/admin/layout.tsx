"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
  BookOpen,
  Wallet,
  Banknote
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "@/lib/auth/auth-client";
import { toast } from "sonner";
import { TopBar } from "@/components/admin/top-bar";

const navItems = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Revenue", href: "/admin/revenue", icon: Wallet },
  { name: "Payouts", href: "/admin/payouts", icon: Banknote },
  { name: "Categories", href: "/admin/categories", icon: Layers },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Courses", href: "/admin/courses", icon: BookOpen },
  { name: "Applications", href: "/admin/instructor-requests", icon: GraduationCap },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileUserOpen, setMobileUserOpen] = useState(false);
  const { data: session } = useSession();

  const handleLogout = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Logged out successfully");
            window.location.href = "/login";
          },
        },
      });
    } catch {
      toast.error("Logout failed");
    }
  };

  const user = {
    name: session?.user?.name || "Admin User",
    email: session?.user?.email || "admin@lms.com",
    image: session?.user?.image,
  };

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <GraduationCap size={18} className="text-white" />
        </div>
        <span className="text-[15px] font-bold tracking-tight text-gray-900">
          LMS <span className="text-indigo-600">Admin</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 group",
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <item.icon
                size={18}
                className={cn("transition-colors", isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600")}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Simple Footer / Help */}
      <div className="p-6 border-t border-gray-50">
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-[12px] font-bold text-gray-900">Need help?</p>
          <p className="text-[11px] text-gray-500 mt-1">Check our documentation or contact support.</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-gray-50/50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-gray-100 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-white z-50 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden border-r border-gray-100",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop TopBar & Mobile Header Combined Logic */}
        <div className="hidden lg:block">
          <TopBar
            title={navItems.find(i => i.href === pathname)?.name || "Dashboard"}
            roleLabel="Admin Account"
            settingsHref="/admin/settings"
            user={user}
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-gray-100 flex items-center px-6 justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <GraduationCap size={16} className="text-white" />
              </div>
              <span className="text-[14px] font-bold text-gray-900">
                LMS Admin
              </span>
            </div>
          </div>
          
          {/* Mobile Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMobileUserOpen((v) => !v)}
              className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[12px] overflow-hidden"
            >
              {user.image ? (
                <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </button>
            {mobileUserOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileUserOpen(false)} />
                <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50">
                  <div className="px-3 py-2 border-b border-gray-50 mb-1">
                    <p className="text-[12px] font-bold text-gray-900 truncate">{user.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    onClick={() => setMobileUserOpen(false)}
                  >
                    View Site
                  </Link>
                  <Link
                    href="/admin/settings"
                    className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    onClick={() => setMobileUserOpen(false)}
                  >
                    Settings
                  </Link>
                  <div className="h-px bg-gray-50 my-1" />
                  <button
                    onClick={() => { setMobileUserOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8 lg:py-10 animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
