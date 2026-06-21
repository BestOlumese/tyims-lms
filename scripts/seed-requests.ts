import "dotenv/config";
import { db } from "../lib/db/index";
import { users } from "../lib/db/schema";
import crypto from "crypto";

async function seed() {
  console.log("🌱 Seeding pending instructor requests...");
  
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not defined in .env");
    process.exit(1);
  }

  const pendingUsers = [
    {
      id: crypto.randomUUID(),
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "STUDENT" as const,
      instructorRequestStatus: "PENDING" as const,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
    },
    {
      id: crypto.randomUUID(),
      name: "Bob Smith",
      email: "bob@example.com",
      role: "STUDENT" as const,
      instructorRequestStatus: "PENDING" as const,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
    },
    {
      id: crypto.randomUUID(),
      name: "Charlie Davis",
      email: "charlie@example.com",
      role: "STUDENT" as const,
      instructorRequestStatus: "PENDING" as const,
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
    },
  ];

  for (const user of pendingUsers) {
    try {
      await db.insert(users).values(user).onConflictDoUpdate({
          target: users.email,
          set: { instructorRequestStatus: "PENDING", role: "STUDENT" }
      });
      console.log(`✅ Seeded: ${user.name} (${user.email})`);
    } catch (e) {
      console.error(`❌ Failed to seed ${user.name}:`, e);
    }
  }

  console.log("✨ Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
