import { db } from "@/lib/db";
import { users as usersTable } from "@/lib/db/schema";
import UsersClient from "@/components/admin/users-client";
import { desc } from "drizzle-orm";

export const metadata = {
  title: "User Management | Admin",
  description: "Manage platform users, roles and permissions.",
};

export default async function AdminUsersPage() {
  // Fetch all users on the server for instant loading
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

  return <UsersClient initialData={users} />;
}
