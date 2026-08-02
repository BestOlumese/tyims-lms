"use client";
import React from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/formatPrice";

function calcServiceFee(totalNgn) {
  const pctFee = Math.min(totalNgn * 0.015, 2000);
  const flatFee = totalNgn > 2500 ? 100 : 0;
  return Math.round(pctFee + flatFee);
}

export default function CartClient() {
  const { items, removeItem, totalPrice } = useCart();
  const serviceFee = totalPrice > 0 ? calcServiceFee(totalPrice) : 0;
  const grandTotal = totalPrice + serviceFee;

  return (
    <section className="tf-spacing-6 shop-cart-wrap">
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="tf-container">
          <div className="row">
            <div className="col-lg-8">
              <div className="table-cart">
                <div className="table-shop-cart overflow-x-auto">

                  {/* ── Head ── */}
                  <ul className="shop-cart-head" style={{ width: "100%", gap: 10 }}>
                    {/* Course label offset by thumbnail (50px) + gap (10px) */}
                    <li className="item" style={{ flex: 1, paddingLeft: 60 }}>Course</li>
                    <li className="item" style={{ width: 160, flexShrink: 0 }}>Price</li>
                    <li className="item" style={{ width: 60, flexShrink: 0 }} />
                  </ul>

                  {/* ── Rows ── */}
                  {items.length > 0 ? (
                    <ul className="shop-cart-inner" style={{ width: "100%" }}>
                      {items.map((item) => {
                        const effectivePrice =
                          item.discountPrice > 0 ? item.discountPrice : item.price;
                        return (
                          <li key={item.courseId}>
                            <ul
                              className="shop-cart-item item wow fadeInUp"
                              data-wow-delay="0s"
                              style={{ gap: 10 }}
                            >
                              {/* Thumbnail — li:nth-child(1) */}
                              <li className="cart-item-img" style={{ flexShrink: 0 }}>
                                {item.thumbnailUrl ? (
                                  <img
                                    alt={item.title}
                                    src={item.thumbnailUrl}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      background: "#f4f4f4",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <i className="flaticon-online-training" style={{ fontSize: 20, color: "#ccc" }} />
                                  </div>
                                )}
                              </li>

                              {/* Title — li:nth-child(2), flex-grow with ellipsis */}
                              <li style={{ flex: 1, minWidth: 0 }}>
                                <Link
                                  href={`/courses/${item.courseId}`}
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 15,
                                    color: "#131836",
                                    display: "block",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {item.title}
                                </Link>
                                {item.instructorName && (
                                  <p
                                    style={{
                                      fontSize: 13,
                                      color: "#888",
                                      marginTop: 3,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    By {item.instructorName}
                                  </p>
                                )}
                              </li>

                              {/* Price — li:nth-child(3) */}
                              <li style={{ width: 160, flexShrink: 0 }}>
                                <p style={{ fontWeight: 600, color: "#131836" }}>
                                  {formatPrice(effectivePrice)}
                                </p>
                                {item.discountPrice > 0 && (
                                  <p style={{ fontSize: 13, color: "#999", textDecoration: "line-through" }}>
                                    {formatPrice(item.price)}
                                  </p>
                                )}
                              </li>

                              {/* Remove — li:nth-child(4) */}
                              <li
                                className="cart-item-action"
                                style={{ width: 60, flexShrink: 0, margin: 0, cursor: "pointer" }}
                                onClick={() => removeItem(item.courseId)}
                              >
                                <i className="flaticon-close-1 icon-close-cart-item" />
                              </li>
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="row mt-5 mb-5 align-items-center" style={{ rowGap: 20 }}>
                      <div className="col-lg-6 sm-col-12 fs-17">Your cart is empty.</div>
                      <div className="col-lg-6 sm-col-12">
                        <Link href="/courses" className="update-cart tf-btn style-third">
                          Explore Courses <i className="icon-arrow-top-right" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-lg-4">
              <div className="sidebar-shop cart-total">
                <div className="cart-total-title text-22 fw-5">Cart Total</div>
                <div className="cart-total-bill">
                  <div className="sub-total">
                    <p>Sub Total</p>
                    <p>{formatPrice(totalPrice)}</p>
                  </div>
                  {serviceFee > 0 && (
                    <div className="sub-total" style={{ paddingTop: 8 }}>
                      <p style={{ fontSize: 14, color: "#888" }}>Service Fee</p>
                      <p style={{ fontSize: 14, color: "#888" }}>{formatPrice(serviceFee)}</p>
                    </div>
                  )}
                  <div className="line" />
                  <div className="total">
                    <p>Total</p>
                    <p>{formatPrice(grandTotal)}</p>
                  </div>
                </div>
                {items.length > 0 && (
                  <Link href="/checkout" className="tf-btn style-third">
                    Proceed to Checkout
                    <i className="icon-arrow-top-right" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
