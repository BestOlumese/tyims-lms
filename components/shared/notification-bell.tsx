"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Bell,
  CheckCheck,
  CreditCard,
  AlertTriangle,
  GraduationCap,
  ShoppingCart,
  Star,
  UserCheck,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Notification bell for the dashboard top bar.
 *
 * Replaces the previous hardcoded list, which showed three fabricated
 * "New Instructor joined" entries and a fake "4 New" badge to every user regardless of
 * what had actually happened.
 *
 * Polls for the unread count so the badge stays current without a socket connection.
 */

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  PAYMENT_SUCCEEDED: CreditCard,
  PAYMENT_FAILED: AlertTriangle,
  INSTRUCTOR_APPLICATION: GraduationCap,
  COURSE_PURCHASED: ShoppingCart,
  COURSE_REVIEWED: Star,
  APPLICATION_APPROVED: UserCheck,
  APPLICATION_REJECTED: UserX,
};

function timeAgo(date: Date | string | null) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: unread } = useQuery({
    ...orpc.notifications.unreadCount.queryOptions(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Only fetch the list once the panel is actually opened.
  const { data: items, isLoading } = useQuery({
    ...orpc.notifications.list.queryOptions({ input: { limit: 15 } }),
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.notifications.unreadCount.queryOptions().queryKey,
    });
    queryClient.invalidateQueries({
      queryKey: orpc.notifications.list.queryOptions({ input: { limit: 15 } }).queryKey,
    });
  };

  const markRead = useMutation({
    ...orpc.notifications.markRead.mutationOptions(),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    ...orpc.notifications.markAllRead.mutationOptions(),
    onSuccess: invalidate,
  });

  const unreadCount = unread?.count ?? 0;
  const list = items ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50">
            <div className="p-3 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-[14px]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate({})}
                  disabled={markAllRead.isPending}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-3 bg-gray-50 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : list.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={20} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-[13px] font-semibold text-gray-500">
                    You&apos;re all caught up
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Payments, applications and reviews will show up here.
                  </p>
                </div>
              ) : (
                list.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  const isUnread = !n.readAt;
                  const content = (
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isUnread ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-400",
                        )}
                      >
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p
                          className={cn(
                            "text-[13px] leading-tight",
                            isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-600",
                          )}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[12px] text-gray-500 leading-snug line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 font-medium">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                      )}
                    </div>
                  );

                  const onActivate = () => {
                    if (isUnread) markRead.mutate({ id: n.id });
                    setOpen(false);
                  };

                  return n.link ? (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={onActivate}
                      className="block p-3 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={n.id}
                      onClick={onActivate}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
