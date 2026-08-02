"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dashboard top-bar search. The input here previously had no handler at all — it looked
 * functional and did nothing.
 *
 * Results are grouped and keyboard navigable. What gets searched is decided server-side
 * from the session role, so an instructor cannot reach another instructor's data no
 * matter what this sends.
 */
export function DashboardSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data, isFetching } = useQuery({
    ...orpc.dashboardSearch.queryOptions({ input: { q: debounced || "_" } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const groups = debounced.length >= 2 ? (data?.groups ?? []) : [];
  const flat = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

  useEffect(() => setActiveIdx(0), [debounced]);

  const go = (href: string) => {
    setOpen(false);
    setTerm("");
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[activeIdx];
      if (item) go(item.href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  let runningIdx = -1;

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 w-80 transition-all focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/20">
        {isFetching ? (
          <Loader2 size={16} className="text-gray-400 animate-spin shrink-0" />
        ) : (
          <Search size={16} className="text-gray-400 shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search…"
          className="bg-transparent border-none outline-none text-[13px] w-full text-gray-700 placeholder:text-gray-400"
        />
        <kbd className="hidden lg:inline text-[10px] font-bold text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 shrink-0">
          ⌘K
        </kbd>
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 mt-2 w-[26rem] max-h-[28rem] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50">
          {flat.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-gray-400">
              {isFetching ? "Searching…" : `No results for “${debounced}”`}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  runningIdx += 1;
                  const idx = runningIdx;
                  return (
                    <button
                      key={`${group.label}-${item.id}`}
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl transition-colors flex items-center gap-2",
                        idx === activeIdx ? "bg-indigo-50" : "hover:bg-gray-50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-[11px] text-gray-400 truncate">{item.subtitle}</p>
                        )}
                      </div>
                      {idx === activeIdx && (
                        <CornerDownLeft size={13} className="text-indigo-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              }
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
