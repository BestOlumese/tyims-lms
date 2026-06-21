const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const BASE = "https://api.paystack.co";

function headers() {
  return {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    "Content-Type": "application/json",
  };
}

/** Calculate Paystack service fee in kobo.
 *  Formula: 1.5% of amount + ₦100 (if amount > ₦2,500), capped at ₦2,000 on the percentage.
 *  All inputs and outputs in kobo.
 */
export function calcServiceFee(amountKobo: number): number {
  const amountNgn = amountKobo / 100;
  const pctFee = Math.min(amountNgn * 0.015, 2000);
  const flatFee = amountNgn > 2500 ? 100 : 0;
  return Math.round((pctFee + flatFee) * 100); // back to kobo
}

export type PaystackInitResult = {
  accessCode: string;
  reference: string;
  authorizationUrl: string;
};

export async function initializeTransaction(opts: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitResult> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      reference: opts.reference,
      metadata: opts.metadata ?? {},
      currency: "NGN",
    }),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || "Paystack init failed");
  return {
    accessCode: json.data.access_code,
    reference: json.data.reference,
    authorizationUrl: json.data.authorization_url,
  };
}

export type PaystackVerifyResult = {
  status: "success" | "failed" | "abandoned" | "pending";
  amountKobo: number;
  reference: string;
  paidAt: string | null;
};

export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: headers(),
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || "Paystack verify failed");
  return {
    status: json.data.status,
    amountKobo: json.data.amount,
    reference: json.data.reference,
    paidAt: json.data.paid_at ?? null,
  };
}

/** Verify Paystack webhook signature — HMAC-SHA512 of raw body */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}
