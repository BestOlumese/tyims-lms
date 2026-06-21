import { Suspense } from "react";
import CourseLearningClient from "@/components/students/CourseLearningClient";

type Props = { params: Promise<{ id: string }> };

export default async function LearnPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <p style={{ color: "#888" }}>Loading course...</p>
        </div>
      }
    >
      <CourseLearningClient courseId={id} />
    </Suspense>
  );
}
