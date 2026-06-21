import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PendingInstructors } from "@/components/admin/pending-instructors";
import { ShieldCheck } from "lucide-react";
import { and, eq, or, desc } from "drizzle-orm";

export const metadata = {
  title: "Instructor Applications | Admin",
  description: "Review and manage instructor applications.",
};

export default async function InstructorRequestsPage() {
  // Pre-fetch requests on the server for instant loading
  const requests = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.role, "STUDENT"),
        or(
          eq(users.instructorRequestStatus, "PENDING"),
          eq(users.instructorRequestStatus, "REJECTED")
        )
      )
    )
    .orderBy(desc(users.updatedAt));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShieldCheck size={18} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Instructor Applications</h1>
          </div>
          <p className="text-sm text-gray-500">Review and process applications from users wishing to become instructors.</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <PendingInstructors initialData={requests} />
      </div>
    </div>
  );
}
