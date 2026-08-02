"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { formatKobo } from "@/lib/revenue";
import { toast } from "sonner";
import {
  Wallet,
  Clock,
  CheckCircle2,
  Landmark,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Instructor withdrawals.
 *
 * The server is the authority on everything here — eligibility, fees, limits and the
 * balance are all recomputed server-side on submit. This component only presents them.
 */

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: "Awaiting approval", className: "bg-amber-50 text-amber-700" },
  PROCESSING: { label: "Processing", className: "bg-blue-50 text-blue-700" },
  SUCCESS: { label: "Paid", className: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-600" },
  REVERSED: { label: "Reversed", className: "bg-red-50 text-red-600" },
  CANCELLED: { label: "Declined", className: "bg-gray-100 text-gray-600" },
};

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-sm", className)}>
      {children}
    </div>
  );
}

export default function WithdrawClient() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");

  const { data: overview, isLoading } = useQuery(orpc.payouts.getOverview.queryOptions());
  const { data: history } = useQuery(orpc.payouts.history.queryOptions({ input: { limit: 20 } }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: orpc.payouts.getOverview.queryOptions().queryKey });
    queryClient.invalidateQueries({
      queryKey: orpc.payouts.history.queryOptions({ input: { limit: 20 } }).queryKey,
    });
  };

  const withdrawMutation = useMutation({
    ...orpc.payouts.requestWithdrawal.mutationOptions(),
    onSuccess: (res) => {
      toast.success(res.message);
      setAmount("");
      setPin("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Withdrawal failed"),
  });

  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const { balance, eligibility, limits, account, pin: pinState } = overview;
  const amountKobo = Math.round((Number(amount) || 0) * 100);
  const feeKobo = amountKobo > 0 ? estimateFee(amountKobo) : 0;
  const netKobo = Math.max(amountKobo - feeKobo, 0);
  const belowMin = amountKobo > 0 && amountKobo < limits.minKobo;
  const overBalance = amountKobo > balance.availableKobo;
  const needsApproval = amountKobo > limits.autoApproveMaxKobo;

  const canSubmit =
    eligibility.eligible &&
    amountKobo >= limits.minKobo &&
    !overBalance &&
    /^\d{6}$/.test(pin) &&
    !withdrawMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Available</p>
            <Wallet size={16} className="text-gray-300" />
          </div>
          <p className="mt-3 text-[26px] leading-none font-bold text-gray-900 tabular-nums">
            {formatKobo(balance.availableKobo)}
          </p>
          <p className="mt-2 text-[11px] text-gray-400">Ready to withdraw</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Pending</p>
            <Clock size={16} className="text-gray-300" />
          </div>
          <p className="mt-3 text-[26px] leading-none font-bold text-gray-900 tabular-nums">
            {formatKobo(balance.pendingKobo)}
          </p>
          <p className="mt-2 text-[11px] text-gray-400">
            Clears {limits.holdDays} days after purchase
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Withdrawn</p>
            <CheckCircle2 size={16} className="text-gray-300" />
          </div>
          <p className="mt-3 text-[26px] leading-none font-bold text-gray-900 tabular-nums">
            {formatKobo(balance.withdrawnKobo)}
          </p>
          {balance.reservedKobo > 0 && (
            <p className="mt-2 text-[11px] text-blue-600 font-semibold">
              {formatKobo(balance.reservedKobo)} in progress
            </p>
          )}
        </Card>
      </div>

      {/* Blockers */}
      {!eligibility.eligible && (
        <Card className="p-5 border-amber-100 bg-amber-50/40">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-gray-900">
                Before you can withdraw
              </p>
              <ul className="mt-2 space-y-1.5">
                {eligibility.blockers.map((b) => (
                  <li key={b.reason} className="text-[13px] text-gray-600 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {b.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BankAccountSection account={account} onSaved={refresh} />
        <PinSection isSet={pinState.isSet} isLocked={pinState.isLocked} onSaved={refresh} />
      </div>

      {/* Withdraw */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-[15px] font-bold text-gray-900">Withdraw</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Minimum {formatKobo(limits.minKobo)} · fees are deducted from the amount
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="wd-amount" className="block text-[12px] font-bold text-gray-700 mb-1.5">
              Amount (₦)
            </label>
            <input
              id="wd-amount"
              type="number"
              inputMode="decimal"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!eligibility.eligible}
              placeholder="0.00"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px] text-gray-400">
                Available {formatKobo(balance.availableKobo)}
              </p>
              <button
                type="button"
                onClick={() => setAmount(String(balance.availableKobo / 100))}
                disabled={balance.availableKobo < limits.minKobo}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 disabled:text-gray-300"
              >
                Withdraw all
              </button>
            </div>
            {belowMin && (
              <p className="text-[12px] text-red-600 mt-1.5">
                Minimum withdrawal is {formatKobo(limits.minKobo)}.
              </p>
            )}
            {overBalance && (
              <p className="text-[12px] text-red-600 mt-1.5">
                That&apos;s more than your available balance.
              </p>
            )}
          </div>

          {/* Fee breakdown — shown before confirming, never after */}
          {amountKobo > 0 && !belowMin && !overBalance && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
              <Row label="Amount" value={formatKobo(amountKobo)} />
              <Row label="Transfer fee + stamp duty" value={`− ${formatKobo(feeKobo)}`} />
              <div className="h-px bg-gray-200 my-1" />
              <Row label="You receive" value={formatKobo(netKobo)} bold />
              {needsApproval && (
                <p className="text-[11px] text-amber-700 pt-1">
                  Above {formatKobo(limits.autoApproveMaxKobo)} — an admin will review this before it&apos;s sent.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="wd-pin" className="block text-[12px] font-bold text-gray-700 mb-1.5">
              Transaction PIN
            </label>
            <input
              id="wd-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              disabled={!eligibility.eligible || !pinState.isSet}
              placeholder="••••••"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] tracking-[0.4em] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-50"
            />
            {pinState.isLocked && (
              <p className="text-[12px] text-red-600 mt-1.5">
                Too many incorrect attempts. Withdrawals are temporarily locked.
              </p>
            )}
          </div>

          <button
            onClick={() => withdrawMutation.mutate({ amountKobo, pin })}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-[14px] font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {withdrawMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Withdraw {netKobo > 0 ? formatKobo(netKobo) : ""}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </Card>

      {/* History */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-[15px] font-bold text-gray-900">Withdrawal history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">To</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!history || history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-gray-400">
                    No withdrawals yet.
                  </td>
                </tr>
              ) : (
                history.map((p) => {
                  const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.REQUESTED;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-[13px] text-gray-500 whitespace-nowrap">
                        {new Date(p.requestedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-gray-700">
                        {p.bankName}
                        <span className="text-gray-400"> · {p.accountNumberMasked}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold", s.className)}>
                          {s.label}
                        </span>
                        {p.failureReason && (
                          <p className="text-[11px] text-gray-400 mt-0.5 max-w-[220px] truncate">
                            {p.failureReason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[13px] font-bold text-gray-900 text-right tabular-nums whitespace-nowrap">
                        {formatKobo(p.netKobo)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-[12px]", bold ? "font-bold text-gray-900" : "text-gray-500")}>
        {label}
      </span>
      <span
        className={cn(
          "text-[13px] tabular-nums",
          bold ? "font-bold text-gray-900" : "text-gray-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Mirrors lib/payouts/config.ts calcPayoutFeeKobo so the breakdown can update as the user
 * types without a round trip. The SERVER figure is authoritative — this is display only.
 */
function estimateFee(amountKobo: number): number {
  const naira = amountKobo / 100;
  const transfer = naira <= 5000 ? 10 : naira <= 50000 ? 25 : 50;
  const stamp = naira >= 10000 ? 50 : 0;
  return Math.round((transfer + stamp) * 100);
}

/* ── Bank account ─────────────────────────────────────────────────────────── */

function BankAccountSection({
  account,
  onSaved,
}: {
  account: {
    bankName: string;
    accountName: string;
    accountNumberMasked: string;
    verified: boolean;
    nameMatchScore: number;
  } | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!account);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [preview, setPreview] = useState<{ accountName: string; willAutoVerify: boolean } | null>(null);

  const { data: banks } = useQuery({
    ...orpc.payouts.getBanks.queryOptions(),
    enabled: editing,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const resolveMutation = useMutation({
    ...orpc.payouts.resolveAccount.mutationOptions(),
    onSuccess: (r) => setPreview({ accountName: r.accountName, willAutoVerify: r.willAutoVerify }),
    onError: (e: Error) => {
      setPreview(null);
      toast.error(e.message || "Could not verify that account");
    },
  });

  const saveMutation = useMutation({
    ...orpc.payouts.saveAccount.mutationOptions(),
    onSuccess: (r) => {
      toast.success(r.message);
      setEditing(false);
      setPreview(null);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save bank account"),
  });

  const selectedBank = banks?.find((b) => b.code === bankCode);
  const canResolve = /^\d{10}$/.test(accountNumber) && bankCode !== "";

  return (
    <Card>
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-gray-400" />
          <h3 className="text-[15px] font-bold text-gray-900">Bank account</h3>
        </div>
        {account && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] font-bold text-indigo-600 hover:text-indigo-700"
          >
            Change
          </button>
        )}
      </div>

      <div className="p-5">
        {account && !editing ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-gray-900">{account.accountName}</p>
              {account.verified ? (
                <ShieldCheck size={15} className="text-emerald-600" />
              ) : (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Under review
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-500">
              {account.bankName} · {account.accountNumberMasked}
            </p>
            {!account.verified && (
              <p className="text-[12px] text-gray-500 pt-2">
                The account name didn&apos;t closely match your profile name, so an admin is
                reviewing it. You&apos;ll be able to withdraw once it&apos;s approved.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Bank</label>
              <select
                value={bankCode}
                onChange={(e) => {
                  setBankCode(e.target.value);
                  setPreview(null);
                }}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select your bank…</option>
                {(banks ?? []).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                Account number
              </label>
              <input
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/\D/g, ""));
                  setPreview(null);
                }}
                placeholder="10 digits"
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {preview && (
              <div
                className={cn(
                  "rounded-xl p-3",
                  preview.willAutoVerify ? "bg-emerald-50" : "bg-amber-50",
                )}
              >
                <p className="text-[13px] font-bold text-gray-900">{preview.accountName}</p>
                <p className="text-[12px] text-gray-600 mt-0.5">
                  {preview.willAutoVerify
                    ? "This matches your profile name."
                    : "This doesn't closely match your profile name — an admin will review it before you can withdraw."}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => resolveMutation.mutate({ accountNumber, bankCode })}
                disabled={!canResolve || resolveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {resolveMutation.isPending ? "Checking…" : "Verify account"}
              </button>
              <button
                onClick={() =>
                  saveMutation.mutate({
                    accountNumber,
                    bankCode,
                    bankName: selectedBank?.name ?? "",
                  })
                }
                disabled={!preview || saveMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            {account && (
              <button
                onClick={() => {
                  setEditing(false);
                  setPreview(null);
                }}
                className="w-full text-[12px] text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── PIN ──────────────────────────────────────────────────────────────────── */

function PinSection({
  isSet,
  isLocked,
  onSaved,
}: {
  isSet: boolean;
  isLocked: boolean;
  onSaved: () => void;
}) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [changing, setChanging] = useState(false);

  const setMutation = useMutation({
    ...orpc.payouts.setPin.mutationOptions(),
    onSuccess: () => {
      toast.success("Transaction PIN set");
      setNewPin("");
      setConfirmPin("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not set PIN"),
  });

  const changeMutation = useMutation({
    ...orpc.payouts.changePin.mutationOptions(),
    onSuccess: () => {
      toast.success("Transaction PIN changed");
      setNewPin("");
      setConfirmPin("");
      setCurrentPin("");
      setChanging(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not change PIN"),
  });

  const mismatch = confirmPin.length === 6 && newPin !== confirmPin;
  const valid = /^\d{6}$/.test(newPin) && newPin === confirmPin;

  return (
    <Card>
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-gray-400" />
          <h3 className="text-[15px] font-bold text-gray-900">Transaction PIN</h3>
        </div>
        {isSet && !changing && (
          <button
            onClick={() => setChanging(true)}
            className="text-[12px] font-bold text-indigo-600 hover:text-indigo-700"
          >
            Change
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {isSet && !changing ? (
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <p className="text-[13px] text-gray-600">
              Your PIN is set and required for every withdrawal.
            </p>
          </div>
        ) : (
          <>
            {changing && (
              <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} />
            )}
            <PinInput label={isSet ? "New PIN" : "Choose a 6-digit PIN"} value={newPin} onChange={setNewPin} />
            <PinInput label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} />
            {mismatch && <p className="text-[12px] text-red-600">PINs don&apos;t match.</p>}
            <button
              onClick={() =>
                changing
                  ? changeMutation.mutate({ currentPin, newPin })
                  : setMutation.mutate({ pin: newPin })
              }
              disabled={!valid || (changing && currentPin.length !== 6)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {changing ? "Change PIN" : "Set PIN"}
            </button>
            {changing && (
              <button
                onClick={() => setChanging(false)}
                className="w-full text-[12px] text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </>
        )}

        {isLocked && (
          <div className="flex items-start gap-2 bg-red-50 rounded-xl p-3">
            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-gray-700">
              Locked after too many incorrect attempts. Try again later, or ask an admin to
              unlock it.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function PinInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-bold text-gray-700 mb-1.5">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder="••••••"
        className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-[14px] tracking-[0.4em] outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
    </div>
  );
}
