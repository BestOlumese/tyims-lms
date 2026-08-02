/**
 * Paystack Transfers + account verification.
 *
 * Kept separate from lib/paystack.ts (which handles collecting money) because this file
 * *sends* money. Everything here is security-sensitive.
 *
 * NEVER log a full account number, a recipient code, or the secret key.
 *
 * Transfers are asynchronous: POST /transfer only queues the request. The final outcome
 * arrives via the transfer.success / transfer.failed / transfer.reversed webhooks, so a
 * payout is never "done" at request time.
 *
 * Requires "Transfers OTP" to be DISABLED in Paystack Dashboard → Preferences, otherwise
 * every transfer stops for a human to enter a code.
 */

const BASE = "https://api.paystack.co";

function secret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${secret()}`,
    "Content-Type": "application/json",
  };
}

/** True when the configured key is a test key — used to keep destructive calls out of prod. */
export function isTestMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test");
}

/**
 * Turns Paystack's raw messages into something an admin can act on.
 *
 * These are account-level conditions, not bugs — showing the raw string leaves people
 * guessing at what to actually do.
 */
function explainPaystackError(raw: string): string {
  const m = raw.toLowerCase();

  if (m.includes("starter business")) {
    return (
      "Paystack Transfers are not available on a Starter Business account. " +
      "Upgrade to a Registered Business on the Paystack Dashboard (Compliance → Business Type) " +
      "to enable payouts."
    );
  }
  if (m.includes("otp")) {
    return (
      "Paystack is asking for a transfer OTP. Disable Transfers OTP in " +
      "Paystack Dashboard → Settings → Preferences to allow automatic payouts."
    );
  }
  if (m.includes("balance") || m.includes("insufficient")) {
    return "Insufficient Paystack balance to fund this transfer. Top up your Paystack account.";
  }
  if (m.includes("daily limit") && m.includes("resolve")) {
    return (
      "Paystack's test-mode limit of 3 live bank lookups per day has been reached. " +
      "Try again tomorrow, or switch to live keys."
    );
  }
  return raw;
}

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: headers() });
    const json = await res.json();
    if (!json.status) {
      return {
        ok: false,
        message: explainPaystackError(json.message || `Paystack error (${res.status})`),
      };
    }
    return { ok: true, data: json.data as T };
  } catch (err) {
    // Deliberately does not include the path — it can contain an account number.
    console.error("[paystack-transfers] request failed", err);
    return { ok: false, message: "Could not reach Paystack. Please try again." };
  }
}

export type Bank = { name: string; code: string; slug: string };

/** Banks available for NGN transfers, for the bank picker. */
export async function listBanks(): Promise<Bank[]> {
  const res = await paystackFetch<Bank[]>("/bank?currency=NGN&perPage=100");
  if (!res.ok) return [];
  return res.data.map((b) => ({ name: b.name, code: b.code, slug: b.slug }));
}

export type ResolvedAccount = { accountNumber: string; accountName: string };

/**
 * Resolve an account number to the REAL account holder name.
 *
 * This is the anti-fraud check: the name comes from the bank, never from the user, so an
 * instructor cannot claim an account belongs to them when it doesn't. Free endpoint.
 */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string,
): Promise<{ ok: true; account: ResolvedAccount } | { ok: false; message: string }> {
  const res = await paystackFetch<{ account_number: string; account_name: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  if (!res.ok) {
    return { ok: false, message: res.message || "Could not verify that account." };
  }
  return {
    ok: true,
    account: {
      accountNumber: res.data.account_number,
      accountName: res.data.account_name,
    },
  };
}

/**
 * Create (or re-create) a transfer recipient. Returns the recipient_code we store and
 * reuse for every subsequent payout to this account.
 */
export async function createTransferRecipient(params: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<{ ok: true; recipientCode: string } | { ok: false; message: string }> {
  const res = await paystackFetch<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "NGN",
    }),
  });
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, recipientCode: res.data.recipient_code };
}

export type TransferInitResult = {
  transferCode: string;
  status: string;
  reference: string;
};

/**
 * Queue a transfer.
 *
 * `reference` is OUR idempotency key (payout.reference, unique-constrained). If this is
 * retried with the same reference Paystack rejects the duplicate rather than sending twice.
 *
 * A non-error response does NOT mean the money arrived — wait for the webhook.
 */
export async function initiateTransfer(params: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}): Promise<{ ok: true; result: TransferInitResult } | { ok: false; message: string }> {
  const res = await paystackFetch<{
    transfer_code: string;
    status: string;
    reference: string;
  }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: params.amountKobo,
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason ?? "Instructor payout",
    }),
  });

  if (!res.ok) return { ok: false, message: res.message };
  return {
    ok: true,
    result: {
      transferCode: res.data.transfer_code,
      status: res.data.status,
      reference: res.data.reference,
    },
  };
}

/** Platform balance — so we can refuse a payout we cannot actually fund. */
export async function getPlatformBalanceKobo(): Promise<number | null> {
  const res = await paystackFetch<{ currency: string; balance: number }[]>("/balance");
  if (!res.ok) return null;
  const ngn = res.data.find((b) => b.currency === "NGN");
  return ngn ? ngn.balance : 0;
}

/** Mask an account number for display and storage in payout history: 0123456789 → ******6789 */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return "*".repeat(accountNumber.length);
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}
