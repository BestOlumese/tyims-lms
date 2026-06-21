import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

export type Context = {
  user: {
    id: string;
    email: string;
    role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
    paystackCustomerCode?: string | null;
    paystackSubaccountCode?: string | null;
  } | null;
};

export async function createContext(): Promise<Context> {
  const reqHeaders = await headers();
  
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !session.user) {
    return { user: null };
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role as "STUDENT" | "INSTRUCTOR" | "ADMIN",
      paystackCustomerCode: session.user.paystackCustomerCode as string | null,
      paystackSubaccountCode: session.user.paystackSubaccountCode as string | null,
    },
  };
}