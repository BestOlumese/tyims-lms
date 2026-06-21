"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useCart } from "@/lib/cart-context";
import { authClient } from "@/lib/auth/auth-client";
import { formatPrice } from "@/lib/formatPrice";
import Link from "next/link";

function calcServiceFee(totalNgn) {
  if (totalNgn === 0) return 0;
  const pctFee = Math.min(totalNgn * 0.015, 2000);
  const flatFee = totalNgn > 2500 ? 100 : 0;
  return Math.round(pctFee + flatFee);
}

export default function CheckoutClient() {
  const { items, totalPrice, clearCart } = useCart();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const user = session?.user;
  const serviceFee = calcServiceFee(totalPrice);
  const grandTotal = totalPrice + serviceFee;
  const allFree = totalPrice === 0;

  const verifyMutation = useMutation(
    orpc.student.verifyPayment.mutationOptions({
      onSuccess: () => {
        clearCart();
        router.push("/my-courses?enrolled=1");
      },
      onError: (err) => {
        setError(err?.message || "Payment verification failed. Contact support if your payment was deducted.");
        setProcessing(false);
      },
    }),
  );

  const initMutation = useMutation(
    orpc.student.initializePayment.mutationOptions({
      onSuccess: (data) => {
        if (data.type === "free") {
          clearCart();
          router.push("/my-courses?enrolled=1");
          return;
        }
        const handler = /** @type {any} */ (window).PaystackPop.setup({
          key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
          email: user?.email,
          amount: data.amountKobo,
          ref: data.reference,
          currency: "NGN",
          callback: (response) => {
            verifyMutation.mutate({ reference: response.reference });
          },
          onClose: () => {
            setError("Payment was cancelled. Your cart is still saved.");
            setProcessing(false);
          },
        });
        handler.openIframe();
      },
      onError: (err) => {
        setError(err?.message || "Could not initialise payment. Please try again.");
        setProcessing(false);
      },
    }),
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) { router.push("/login"); return; }
    if (items.length === 0) return;
    setError("");
    setProcessing(true);
    initMutation.mutate({ courseIds: items.map((i) => i.courseId) });
  };

  if (items.length === 0) {
    return (
      <section className="tf-spacing-22 shop-checkout">
        <div className="tf-container" style={{ padding: "80px 0", textAlign: "center" }}>
          <i className="flaticon-online-learning" style={{ fontSize: 64, color: "#ccc" }} />
          <p style={{ marginTop: 16, color: "#888" }}>Your cart is empty.</p>
          <Link href="/courses" className="tf-btn" style={{ marginTop: 24, display: "inline-block" }}>
            Browse Courses <i className="icon-arrow-top-right" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <script src="https://js.paystack.co/v1/inline.js" async />

      <section className="tf-spacing-22 shop-checkout">
        <form onSubmit={handleSubmit} className="form-checkout">
          <div className="tf-container">
            <div className="row">

              {/* ── Left: billing details ── */}
              <div className="col-lg-8">
                <div className="checkout-billing">
                  <h6 className="text-22 fw-5 wow fadeInUp">Billing details</h6>

                  <div className="cols">
                    <fieldset className="tf-field wow fadeInUp">
                      <input
                        className="tf-input style-1"
                        id="co-name"
                        type="text"
                        name="name"
                        tabIndex={2}
                        defaultValue={user?.name || ""}
                        aria-required="true"
                        required
                      />
                      <label className="tf-field-label fs-15" htmlFor="co-name">
                        Full Name *
                      </label>
                    </fieldset>
                    <fieldset className="tf-field wow fadeInUp" data-wow-delay="0.1s">
                      <input
                        className="tf-input style-1"
                        id="co-email"
                        type="email"
                        name="email"
                        tabIndex={2}
                        defaultValue={user?.email || ""}
                        readOnly
                        aria-required="true"
                        required
                      />
                      <label className="tf-field-label fs-15" htmlFor="co-email">
                        Email Address *
                      </label>
                    </fieldset>
                  </div>

                  <fieldset className="tf-field wow fadeInUp">
                    <input
                      className="tf-input style-1"
                      id="co-phone"
                      type="tel"
                      name="phone"
                      tabIndex={2}
                      placeholder=""
                      defaultValue=""
                    />
                    <label className="tf-field-label fs-15" htmlFor="co-phone">
                      Phone (optional)
                    </label>
                  </fieldset>

                  {error && (
                    <div
                      className="wow fadeInUp"
                      style={{
                        background: "#fff5f5",
                        border: "1px solid #fed7d7",
                        borderRadius: 8,
                        padding: "14px 18px",
                        color: "#c53030",
                        fontSize: 15,
                        marginTop: 20,
                      }}
                    >
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: order summary + payment ── */}
              <div className="col-lg-4">
                <div className="sidebar-shop-checkout">

                  {/* Order summary */}
                  <div className="sidebar-checkout-item your-order">
                    <div className="title text-22 fw-5">Order summary</div>
                    <div className="product-subtotal fs-15">
                      <p className="fw-5">Course</p>
                      <p className="fw-5">Subtotal</p>
                    </div>
                    <ul className="product-list">
                      {items.map((item) => {
                        const price = item.discountPrice > 0 ? item.discountPrice : item.price;
                        return (
                          <li key={item.courseId} className="product-item">
                            <p className="fs-15 fw-4">{item.title}</p>
                            <p className="fs-15 fw-4">{formatPrice(price)}</p>
                          </li>
                        );
                      })}
                    </ul>
                    <ul className="checkout-total-bill">
                      <li className="subtotal fw-5">
                        <p>Subtotal</p>
                        <p>{formatPrice(totalPrice)}</p>
                      </li>
                      {serviceFee > 0 && (
                        <li className="shipping fw-5">
                          <p>Service Fee</p>
                          <p>{formatPrice(serviceFee)}</p>
                        </li>
                      )}
                      <li className="total">
                        <p className="h4">Total</p>
                        <p className="h4">{formatPrice(grandTotal)}</p>
                      </li>
                    </ul>
                  </div>

                  {/* Payment method */}
                  <div className="sidebar-checkout-item payment">
                    <h6 className="text-22 fw-5">Payment</h6>
                    <fieldset>
                      <ul className="payment-list">
                        {allFree ? (
                          <>
                            <li className="payment-item radio-item">
                              <label htmlFor="pay-free">
                                <p>Free Enrollment</p>
                                <input name="payment-method" type="radio" id="pay-free" defaultChecked />
                                <span className="btn-radio" />
                              </label>
                            </li>
                            <li className="payment-item radio-item">
                              <p className="descripton">
                                All selected courses are free. Click below to enroll instantly.
                              </p>
                            </li>
                          </>
                        ) : (
                          <>
                            <li className="payment-item radio-item">
                              <label htmlFor="pay-paystack">
                                <p>Pay with Paystack</p>
                                <input name="payment-method" type="radio" id="pay-paystack" defaultChecked />
                                <span className="btn-radio" />
                              </label>
                            </li>
                            <li className="payment-item radio-item">
                              <p className="descripton">
                                Secure payment via Paystack. A payment popup will appear — complete payment to get instant access.
                              </p>
                            </li>
                          </>
                        )}
                      </ul>
                    </fieldset>
                  </div>

                  <button
                    className="tf-btn"
                    type="submit"
                    disabled={processing || verifyMutation.isPending}
                  >
                    {processing || verifyMutation.isPending
                      ? "Processing..."
                      : allFree
                        ? "Enroll Now"
                        : `Pay ${formatPrice(grandTotal)}`}
                    <i className="icon-arrow-top-right" />
                  </button>

                </div>
              </div>

            </div>
          </div>
        </form>
      </section>
    </>
  );
}
