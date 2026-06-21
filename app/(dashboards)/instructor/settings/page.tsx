import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { SettingsClient } from "@/components/instructor/settings-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function InstructorSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  const [userProfile] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!userProfile) {
    redirect("/login");
  }

  return <SettingsClient user={userProfile} />;
}
