import InstructorProfileClient from "@/components/students/InstructorProfileClient";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, id));
    return {
      title: user ? `${user.name} | TYIMS LMS` : "Instructor | TYIMS LMS",
    };
  } catch {
    return { title: "Instructor | TYIMS LMS" };
  }
}

export default async function InstructorPage({ params }: Props) {
  const { id } = await params;
  return <InstructorProfileClient id={id} />;
}
