import { betterFetch } from "@better-fetch/fetch";
import { NextResponse, type NextRequest } from "next/server";

/** Routes under a guarded prefix that must stay reachable while logged out. */
const PUBLIC_EXCEPTIONS = ["/admin/login"];

/**
 * Segment-safe prefix test. `isUnder("/instructors", "/instructor")` is false,
 * so the public `/instructors` listing is never mistaken for the instructor dashboard.
 */
function isUnder(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // The admin login page lives under /admin but must be reachable while logged out,
  // otherwise an admin can never sign in.
  if (PUBLIC_EXCEPTIONS.includes(path)) {
    return NextResponse.next();
  }

  // 1. Fetch the session from BetterAuth
  const { data: session } = await betterFetch<any>("/api/auth/get-session", {
    baseURL: process.env.BETTER_AUTH_URL || request.nextUrl.origin,
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  // 2. Protect Instructor Routes
  if (isUnder(path, "/instructor")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // 3. Protect Admin Routes
  if (isUnder(path, "/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 4. Protect Student Routes
  if (isUnder(path, "/dashboard") || isUnder(path, "/my-courses")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/instructor/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/my-courses/:path*",
  ],
};
