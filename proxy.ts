import { betterFetch } from "@better-fetch/fetch";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // 1. Fetch the session from BetterAuth
  const { data: session } = await betterFetch<any>(
    "/api/auth/get-session",
    {
      baseURL: process.env.BETTER_AUTH_URL || request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    }
  );

  const path = request.nextUrl.pathname;

  // 2. Protect Instructor Routes
  if (path.startsWith("/instructor")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/student/dashboard", request.url));
    }
  }

  // 3. Protect Admin Routes
  if (path.startsWith("/admin")) {
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/instructor/:path*", "/admin/:path*", "/student/:path*"],
};