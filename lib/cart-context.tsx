"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

export type CartItem = {
  courseId: string;
  title: string;
  price: number;
  discountPrice: number;
  thumbnailUrl: string | null;
  instructorName: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (courseId: string) => void;
  clearCart: () => void;
  isInCart: (courseId: string) => boolean;
  totalPrice: number;
  itemCount: number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lms_cart");
      if (stored) setItems(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("lms_cart", JSON.stringify(items));
    }
  }, [items, hydrated]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      if (prev.find((i) => i.courseId === item.courseId)) return prev;
      return [...prev, item];
    });
  };

  const removeItem = (courseId: string) => {
    setItems((prev) => prev.filter((i) => i.courseId !== courseId));
  };

  const clearCart = () => setItems([]);

  const isInCart = (courseId: string) => items.some((i) => i.courseId === courseId);

  const totalPrice = items.reduce((sum, item) => {
    const price = item.discountPrice > 0 ? item.discountPrice : item.price;
    return sum + price;
  }, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, clearCart, isInCart, totalPrice, itemCount: items.length }}
    >
      {children}
    </CartContext.Provider>
  );
}

const emptyCart: CartContextType = {
  items: [],
  addItem: () => {},
  removeItem: () => {},
  clearCart: () => {},
  isInCart: () => false,
  totalPrice: 0,
  itemCount: 0,
};

export function useCart() {
  return useContext(CartContext) ?? emptyCart;
}
