import AdminPayoutsClient from "@/components/admin/payouts-client";
import { Banknote } from "lucide-react";

export const metadata = {
  title: "Payouts | Admin",
  description: "Review and approve instructor withdrawals.",
};

export default function AdminPayoutsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Banknote size={18} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payouts</h1>
        </div>
        <p className="text-sm text-gray-500">
          Approve instructor withdrawals and review bank accounts that need a human check.
        </p>
      </div>

      <AdminPayoutsClient />
    </div>
  );
}
