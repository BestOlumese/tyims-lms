"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { RevenueChart } from "./revenue-chart";
import { formatKobo, pctChange } from "@/lib/revenue";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Wallet,
  Receipt,
  Users,
  BookOpen,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Revenue analytics, shared by /admin/revenue and /instructor/revenue.
 *
 * `scope` only picks which procedure to call — the filtering is done server-side by role.
 * An instructor's request can never return another instructor's rows regardless of what
 * this component asks for.
 */

type Scope = "admin" | "instructor";

const PRESETS = [
  { label: "7 days", days: 7, granularity: "day" as const },
  { label: "30 days", days: 30, granularity: "day" as const },
  { label: "90 days", days: 90, granularity: "week" as const },
  { label: "12 months", days: 365, granularity: "month" as const },
  { label: "All time", days: 3650, granularity: "month" as const },
];

function KpiTile({
  label,
  value,
  change,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  change?: number | null;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <Icon size={16} className="text-gray-300 shrink-0" />
      </div>
      <p className="mt-3 text-[26px] leading-none font-bold text-gray-900 tabular-nums">{value}</p>
      <div className="mt-2 flex items-center gap-2 min-h-[18px]">
        {change != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-bold",
              up && "text-emerald-600",
              down && "text-red-500",
              !up && !down && "text-gray-400",
            )}
          >
            {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : null}
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
    </div>
  );
}

export function RevenueDashboard({ scope }: { scope: Scope }) {
  const [presetIdx, setPresetIdx] = useState(1); // 30 days
  const preset = PRESETS[presetIdx];

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 24 * 60 * 60 * 1000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: preset.granularity,
    };
  }, [preset]);

  const options =
    scope === "admin"
      ? orpc.revenue.adminAnalytics.queryOptions({ input: range })
      : orpc.revenue.instructorAnalytics.queryOptions({ input: range });

  const { data, isLoading, isError } = useQuery(options);

  const exportCsv = () => {
    if (!data) return;
    const header = [
      "Reference",
      "Date",
      "Buyer",
      "Buyer email",
      "Course",
      "Gross (NGN)",
      "Platform fee (NGN)",
      scope === "admin" ? "Instructor earning (NGN)" : "Your earning (NGN)",
    ];
    // Quote every field and escape embedded quotes — course titles contain commas.
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = data.recentTransactions.map((t) =>
      [
        t.reference,
        t.verifiedAt ? new Date(t.verifiedAt).toISOString() : "",
        t.buyerName ?? "",
        t.buyerEmail ?? "",
        t.courseTitle ?? "",
        (t.grossKobo / 100).toFixed(2),
        (t.platformFeeKobo / 100).toFixed(2),
        (t.netKobo / 100).toFixed(2),
      ].map(esc).join(","),
    );
    const csv = [header.map(esc).join(","), ...rows].join("\r\n");
    // BOM so Excel opens UTF-8 (₦ and accented names) correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <p className="text-[14px] font-bold text-gray-900">Couldn&apos;t load revenue</p>
        <p className="text-[13px] text-gray-500 mt-1">Please refresh and try again.</p>
      </div>
    );
  }

  const cur = data?.current;
  const prev = data?.previous;

  return (
    <div className="space-y-6">
      {/* Filters — one row above the charts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-gray-50 border border-gray-100 rounded-xl p-1">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPresetIdx(i)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors",
                i === presetIdx
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={exportCsv}
          disabled={!data || data.recentTransactions.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading || !cur ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-[118px] animate-pulse">
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-6 bg-gray-100 rounded w-3/4 mt-4" />
            </div>
          ))
        ) : (
          <>
            <KpiTile
              label={scope === "admin" ? "Gross revenue" : "Gross sales"}
              value={formatKobo(cur.grossKobo)}
              change={prev ? pctChange(cur.grossKobo, prev.grossKobo) : null}
              icon={Wallet}
            />
            <KpiTile
              label={scope === "admin" ? "Platform earnings" : "Your earnings"}
              value={formatKobo(scope === "admin" ? cur.platformFeeKobo : cur.netKobo)}
              change={
                prev
                  ? pctChange(
                      scope === "admin" ? cur.platformFeeKobo : cur.netKobo,
                      scope === "admin" ? prev.platformFeeKobo : prev.netKobo,
                    )
                  : null
              }
              icon={Receipt}
            />
            <KpiTile
              label="Courses sold"
              value={String(cur.salesCount)}
              change={prev ? pctChange(cur.salesCount, prev.salesCount) : null}
              icon={BookOpen}
            />
            <KpiTile
              label="Orders"
              value={String(cur.orderCount)}
              hint={cur.orderCount > 0 ? `${(cur.salesCount / cur.orderCount).toFixed(1)} courses/order` : undefined}
              icon={Users}
            />
          </>
        )}
      </div>

      {/* Commission notice — platform earnings of 0 would otherwise look like a bug */}
      {scope === "admin" && cur && cur.grossKobo > 0 && cur.platformFeeKobo === 0 && (
        <div className="flex items-start gap-3 bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold text-gray-900">
              Platform commission is set to 0%
            </p>
            <p className="text-[12px] text-gray-600 mt-0.5">
              Instructors currently keep 100% of each sale. Set{" "}
              <code className="px-1 py-0.5 bg-white rounded border border-blue-100 text-[11px]">
                PLATFORM_COMMISSION_PCT
              </code>{" "}
              in your environment to start taking a cut — every figure here follows automatically.
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      {isLoading || !data ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-[340px] animate-pulse" />
      ) : (
        <RevenueChart
          data={data.series}
          granularity={data.range.granularity}
          valueKey={scope === "admin" ? "grossKobo" : "netKobo"}
          title={scope === "admin" ? "Gross revenue over time" : "Your earnings over time"}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top courses */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-[15px] font-bold text-gray-900">Top earning courses</h3>
          </div>
          {!data || data.topCourses.length === 0 ? (
            <p className="p-8 text-center text-[13px] text-gray-400">No sales in this period.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.topCourses.map((c, i) => (
                <li key={c.courseId} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-[12px] font-bold text-gray-300 w-4 tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">
                      {c.title ?? "Deleted course"}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {c.salesCount} sale{c.salesCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-gray-900 tabular-nums shrink-0">
                    {formatKobo(scope === "admin" ? c.grossKobo : c.netKobo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Admin: per-instructor split. Instructor: nothing (server never sends it). */}
        {scope === "admin" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-[15px] font-bold text-gray-900">Earnings by instructor</h3>
            </div>
            {!data || data.byInstructor.length === 0 ? (
              <p className="p-8 text-center text-[13px] text-gray-400">No sales in this period.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.byInstructor.map((ins) => (
                  <li key={ins.instructorId} className="px-5 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {ins.name ?? "Unknown"}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {ins.salesCount} sale{ins.salesCount === 1 ? "" : "s"} · owed{" "}
                        {formatKobo(ins.netKobo)}
                      </p>
                    </div>
                    <span className="text-[13px] font-bold text-gray-900 tabular-nums shrink-0">
                      {formatKobo(ins.grossKobo)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-gray-900">Recent transactions</h3>
          {data && (
            <span className="text-[11px] font-bold text-gray-400">
              {data.recentTransactions.length} shown
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Buyer</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Course</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">
                  {scope === "admin" ? "Gross" : "You earned"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data || data.recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-gray-400">
                    No transactions in this period.
                  </td>
                </tr>
              ) : (
                data.recentTransactions.map((t) => (
                  <tr key={t.itemId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-[13px] text-gray-500 whitespace-nowrap">
                      {t.verifiedAt ? new Date(t.verifiedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[13px] font-semibold text-gray-900">{t.buyerName ?? "Unknown"}</p>
                      <p className="text-[11px] text-gray-400">{t.buyerEmail}</p>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-gray-700 max-w-[240px] truncate">
                      {t.courseTitle ?? "Deleted course"}
                    </td>
                    <td className="px-5 py-3 text-[13px] font-bold text-gray-900 text-right tabular-nums whitespace-nowrap">
                      {formatKobo(scope === "admin" ? t.grossKobo : t.netKobo)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {scope === "instructor" && (
        <p className="text-[12px] text-gray-400">
          Earnings shown are what you have earned from completed purchases. Payouts are
          handled separately —{" "}
          <Link href="/instructor/settings" className="text-indigo-600 font-semibold">
            check your payout details
          </Link>
          .
        </p>
      )}
    </div>
  );
}
