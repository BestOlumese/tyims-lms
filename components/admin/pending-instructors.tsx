"use client";

import { orpc } from "@/lib/orpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar, 
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PendingInstructorsProps {
  limit?: number;
  initialData?: any[];
}

export const PendingInstructors = ({ limit, initialData }: PendingInstructorsProps) => {
  const { data: requests, isLoading, refetch } = useQuery({
    ...orpc.admin.getPendingInstructors.queryOptions(),
    initialData
  });
  
  const displayedRequests = limit && requests ? requests.slice(0, limit) : requests;
  const handleMutation = useMutation(orpc.admin.handleInstructorRequest.mutationOptions());

  const onHandle = async (userId: string, action: "APPROVE" | "REJECT") => {
    try {
      await handleMutation.mutateAsync({ userId, action });
      toast.success(action === "APPROVE" ? "Instructor approved" : "Request rejected");
      refetch();
    } catch (error) {
      toast.error("Failed to process request");
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-600" /></div>;

  if (!requests || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-gray-300 shadow-sm border border-gray-100 mb-4">
            <UserCheck size={20} />
        </div>
        <p className="text-[13px] font-bold text-gray-400 uppercase tracking-widest text-center">No Pending Requests</p>
        <p className="text-[12px] text-gray-500 mt-1 text-center">All instructor applications have been processed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayedRequests?.map((u) => (
        <div key={u.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all group">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[16px] shadow-sm overflow-hidden shrink-0">
                {u.image ? (
                  <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  u.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-gray-900 truncate">{u.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-gray-400">
                  <Mail size={12} />
                  <p className="text-[12px] font-medium truncate">{u.email}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {u.instructorRequestStatus !== "REJECTED" && (
                <button 
                  onClick={() => onHandle(u.id, "REJECT")}
                  disabled={handleMutation.isPending}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
                >
                  <UserX size={16} />
                  Deny
                </button>
              )}
              <button 
                onClick={() => onHandle(u.id, "APPROVE")}
                disabled={handleMutation.isPending}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-bold shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <UserCheck size={16} />
                Approve
              </button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-4 text-gray-400">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-tighter">
                <Calendar size={12} />
                Requested {new Date(u.updatedAt).toLocaleDateString('en-US')}
            </div>
            <div className="h-3 w-px bg-gray-100" />
            <div className={cn(
              "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-tighter",
              u.instructorRequestStatus === "REJECTED" ? "text-red-500" : "text-amber-500"
            )}>
                <AlertCircle size={12} />
                {u.instructorRequestStatus === "REJECTED" ? "Previously Rejected" : "Awaiting Review"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
