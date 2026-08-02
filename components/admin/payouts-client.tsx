"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { formatKobo } from "@/lib/revenue";
import { toast } from "sonner";
import {
  Loader2,
  ShieldAlert,
  Check,
  X,
  Landmark,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin payout queue.
 *
 * Two things need a human here:
 *   1. withdrawals above the auto-approve threshold
 *   2. bank accounts whose holder name didn't match the instructor's profile name
 *
 * Approving dispatches to Paystack. Rejecting returns the reserved money to the
 * instructor's available balance — it is never silently absorbed.
 */

const STATUS_TABS = [
  { key: "REQUESTED", label: "Needs approval" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SUCCESS", label: "Paid" },
  { key: "FAILED", label: "Failed" },
  { key: "ALL", label: "All" },
] as const;

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  SUCCESS: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-600",
  REVERSED: "bg-red-50 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function AdminPayoutsClient() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["key"]>("REQUESTED");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const listOptions = orpc.payouts.adminList.queryOptions({ input: { status: tab, limit: 50 } });
  const { data, isLoading } = useQuery(listOptions);
  const { data: bankReviews } = useQuery(orpc.payouts.adminBankReviews.queryOptions());

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
    queryClient.invalidateQueries({
      queryKey: orpc.payouts.adminBankReviews.queryOptions().queryKey,
    });
  };

  const approve = useMutation({
    ...orpc.payouts.adminApprove.mutationOptions(),
    onSuccess: () => {
      toast.success("Payout approved and sent");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not approve"),
  });

  const reject = useMutation({
    ...orpc.payouts.adminReject.mutationOptions(),
    onSuccess: () => {
      toast.success("Payout declined — funds returned to the instructor");
      setRejecting(null);
      setReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not decline"),
  });

  const approveBank = useMutation({
    ...orpc.payouts.adminApproveBank.mutationOptions(),
    onSuccess: () => {
      toast.success("Bank account approved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Could not approve account"),
  });

  const clearLock = useMutation({
    ...orpc.payouts.adminClearPinLock.mutationOptions(),
    onSuccess: () => toast.success("PIN lockout cleared"),
    onError: (e: Error) => toast.error(e.message || "Could not clear lockout"),
  });

  return (
    <div className="space-y-6">
      {/* Bank accounts needing review */}
      {bankReviews && bankReviews.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50 flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-600" />
            <h3 className="text-[15px] font-bold text-gray-900">
              Bank accounts awaiting review ({bankReviews.length})
            </h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {bankReviews.map((b) => (
              <li key={b.instructorId} className="px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-gray-900">{b.instructorName}</p>
                    <p className="text-[12px] text-gray-500">{b.instructorEmail}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Landmark size={13} className="text-gray-400" />
                      <span className="text-[13px] text-gray-700">
                        {b.bankName} · {b.accountNumber}
                      </span>
                    </div>
                    <p className="text-[13px] mt-1">
                      Account holder:{" "}
                      <span className="font-bold text-gray-900">{b.accountName}</span>
                      <span className="text-gray-400">
                        {" "}
                        (name match {Math.round(b.nameMatchScore * 100)}%)
                      </span>
                    </p>
                    <p className="text-[12px] text-amber-700 mt-1.5">
                      Only approve if you are satisfied this account belongs to this instructor.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => clearLock.mutate({ instructorId: b.instructorId })}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1.5"
                      title="Clear a PIN lockout for this instructor"
                    >
                      <Unlock size={13} />
                      Unlock PIN
                    </button>
                    <button
                      onClick={() => approveBank.mutate({ instructorId: b.instructorId })}
                      disabled={approveBank.isPending}
                      className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[12px] font-bold hover:bg-gray-800 disabled:opacity-50"
                    >
                      Approve account
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors",
              tab === t.key
                ? "bg-gray-900 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100",
            )}
          >
            {t.label}
            {t.key === "REQUESTED" && data && data.pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px]">
                {data.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Payouts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Instructor</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Destination</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Net</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="h-9 bg-gray-50 rounded-xl" />
                    </td>
                  </tr>
                ))
              ) : !data || data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <p className="text-[14px] font-bold text-gray-900">Nothing here</p>
                    <p className="text-[12px] text-gray-400 mt-1">
                      {tab === "REQUESTED"
                        ? "No withdrawals are waiting for approval."
                        : "No payouts with this status."}
                    </p>
                  </td>
                </tr>
              ) : (
                data.rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 align-top">
                    <td className="px-5 py-4">
                      <p className="text-[13px] font-bold text-gray-900">{p.instructorName}</p>
                      <p className="text-[11px] text-gray-400">{p.instructorEmail}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(p.requestedAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] text-gray-700">{p.accountName}</p>
                      <p className="text-[11px] text-gray-400">
                        {p.bankName} · {p.accountNumberMasked}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold",
                          STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600",
                        )}
                      >
                        {p.status}
                      </span>
                      {p.failureReason && (
                        <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                          {p.failureReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <p className="text-[13px] font-bold text-gray-900 tabular-nums">
                        {formatKobo(p.netKobo)}
                      </p>
                      <p className="text-[11px] text-gray-400 tabular-nums">
                        of {formatKobo(p.amountKobo)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {p.status === "REQUESTED" ? (
                        rejecting === p.id ? (
                          <div className="space-y-2 min-w-[200px]">
                            <input
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Reason for declining…"
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => {
                                  setRejecting(null);
                                  setReason("");
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-gray-500 hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => reject.mutate({ payoutId: p.id, reason })}
                                disabled={reason.trim().length < 3 || reject.isPending}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 disabled:opacity-50"
                              >
                                Confirm decline
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => setRejecting(p.id)}
                              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                              title="Decline"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={() => approve.mutate({ payoutId: p.id })}
                              disabled={approve.isPending}
                              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {approve.isPending ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              Approve &amp; send
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-[12px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[12px] text-gray-500">
        <AlertTriangle size={14} className="text-gray-400 shrink-0 mt-0.5" />
        <p>
          Approving sends money immediately via Paystack and cannot be undone from here.
          Declining returns the full amount to the instructor&apos;s available balance.
        </p>
      </div>
    </div>
  );
}
