import WithdrawClient from "@/components/instructor/withdraw-client";
import { Banknote } from "lucide-react";

export const metadata = {
  title: "Withdraw | Instructor",
  description: "Withdraw your earnings to your bank account.",
};

export default function InstructorWithdrawPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Banknote size={18} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Withdraw</h1>
        </div>
        <p className="text-sm text-gray-500">
          Move your available earnings to your bank account.
        </p>
      </div>

      <WithdrawClient />
    </div>
  );
}
