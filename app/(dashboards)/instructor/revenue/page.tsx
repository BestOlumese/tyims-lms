import { RevenueDashboard } from "@/components/shared/revenue-dashboard";
import { Wallet } from "lucide-react";

export const metadata = {
  title: "Revenue | Instructor",
  description: "Your earnings from course sales.",
};

export default function InstructorRevenuePage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Wallet size={18} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Revenue</h1>
        </div>
        <p className="text-sm text-gray-500">
          What you&apos;ve earned from completed purchases of your courses.
        </p>
      </div>

      <RevenueDashboard scope="instructor" />
    </div>
  );
}
