"use client";

import { useState } from "react";
import { formatKobo, formatKoboCompact } from "@/lib/revenue";

/**
 * Revenue over time — a single-series bar chart.
 *
 * Deliberately ONE series. Gross / platform cut / instructor earnings are three measures
 * of very different magnitude (and platform cut is 0 until a commission is configured),
 * so plotting them together would need a second y-axis — the single worst chart mistake.
 * They're shown as stat tiles above instead; the chart answers one question: how much
 * revenue, when.
 *
 * The hue (#4f46e5) was checked with the palette validator against the light chart
 * surface: lightness band, chroma floor and ≥3:1 contrast all pass. With one series there
 * are no adjacent-pair CVD concerns and no legend is needed — the title names the series.
 */

const SERIES_COLOR = "#4f46e5";

export type RevenuePoint = {
  bucket: string;
  grossKobo: number;
  netKobo: number;
  salesCount: number;
};

function formatBucket(bucket: string, granularity: string) {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  if (granularity === "month") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RevenueChart({
  data,
  granularity = "day",
  valueKey = "grossKobo",
  title = "Revenue over time",
}: {
  data: RevenuePoint[];
  granularity?: string;
  valueKey?: "grossKobo" | "netKobo";
  title?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
        <div className="h-56 flex flex-col items-center justify-center text-center">
          <p className="text-[13px] font-semibold text-gray-500">No revenue in this period</p>
          <p className="text-[12px] text-gray-400 mt-1">
            Completed purchases will appear here.
          </p>
        </div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  // Round the axis top to something readable rather than the raw max.
  const niceMax = (() => {
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / pow) * pow;
  })();

  const GRID_LINES = 4;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {data.length} {granularity === "month" ? "month" : granularity === "week" ? "week" : "day"}
            {data.length === 1 ? "" : "s"} with sales
          </p>
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] font-bold text-gray-500 hover:text-indigo-600 transition-colors shrink-0"
        >
          {showTable ? "View chart" : "View as table"}
        </button>
      </div>

      {showTable ? (
        // Table view — identity and values never depend on colour alone.
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Period</th>
                <th className="py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Revenue</th>
                <th className="py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Sales</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.bucket} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-[13px] text-gray-700">{formatBucket(d.bucket, granularity)}</td>
                  <td className="py-2 text-[13px] text-gray-900 font-semibold text-right tabular-nums">
                    {formatKobo(d[valueKey])}
                  </td>
                  <td className="py-2 text-[13px] text-gray-500 text-right tabular-nums">{d.salesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* Recessive gridlines + y axis labels */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {Array.from({ length: GRID_LINES + 1 }).map((_, i) => {
              const value = niceMax - (niceMax / GRID_LINES) * i;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-300 tabular-nums w-12 shrink-0 text-right">
                    {formatKoboCompact(value)}
                  </span>
                  <div className="flex-1 border-t border-gray-50" />
                </div>
              );
            })}
          </div>

          {/* Bars */}
          <div className="relative flex items-end gap-[2px] h-56 pl-14">
            {data.map((d, i) => {
              const value = d[valueKey];
              const pct = (value / niceMax) * 100;
              const isHovered = hover === i;
              return (
                <div
                  key={d.bucket}
                  className="relative flex-1 h-full flex items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-white shadow-lg pointer-events-none">
                      <p className="text-[11px] font-bold">{formatKobo(value)}</p>
                      <p className="text-[10px] text-gray-300">
                        {formatBucket(d.bucket, granularity)} · {d.salesCount} sale
                        {d.salesCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  )}
                  <div
                    className="w-full transition-opacity"
                    style={{
                      height: `${Math.max(pct, value > 0 ? 1.5 : 0)}%`,
                      minWidth: 6,
                      maxWidth: 56,
                      background: SERIES_COLOR,
                      // 4px rounded data-end, square against the baseline
                      borderRadius: "4px 4px 0 0",
                      opacity: hover === null || isHovered ? 1 : 0.45,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* X labels — selective, so they never collide */}
          <div className="flex gap-[2px] pl-14 mt-2">
            {data.map((d, i) => {
              const step = Math.ceil(data.length / 8);
              const show = data.length <= 8 || i % step === 0 || i === data.length - 1;
              return (
                <div key={d.bucket} className="flex-1 text-center min-w-0">
                  {show && (
                    <span className="text-[10px] text-gray-400 truncate block">
                      {formatBucket(d.bucket, granularity)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
