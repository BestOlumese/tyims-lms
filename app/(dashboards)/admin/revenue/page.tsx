import { RevenueDashboard } from "@/components/shared/revenue-dashboard";
import { Wallet } from "lucide-react";

export const metadata = {
  title: "Revenue | Admin",
  description: "Platform revenue, earnings and transactions.",
};

export default function AdminRevenuePage() {
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
          Platform-wide earnings from completed purchases, broken down by course and instructor.
        </p>
      </div>

      <RevenueDashboard scope="admin" />
    </div>
  );
}
