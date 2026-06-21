import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not allowed in production", { status: 403 });
  }

  const usersToSeed = [
    { email: "admin@lms.com", password: "password123", name: "Admin User", role: "ADMIN" },
    { email: "instructor@lms.com", password: "password123", name: "Instructor User", role: "INSTRUCTOR" },
    { email: "student@lms.com", password: "password123", name: "Student User", role: "STUDENT" },
  ];

  try {
    const results = [];
    for (const u of usersToSeed) {
      try {
        const res = await auth.api.signUpEmail({
          body: {
            email: u.email,
            password: u.password,
            name: u.name,
            role: u.role,
          },
        });
        results.push({ email: u.email, status: "created" });
      } catch (e: any) {
        results.push({ email: u.email, status: "skipped", reason: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
