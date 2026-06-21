"use client";

import { useState, useMemo } from "react";
import { orpc } from "@/lib/orpc";
import { 
  Search, 
  Ban, 
  Unlock, 
  Mail, 
  Shield, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Eye,
  UserX,
  X,
  ArrowUpDown,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";

interface UsersClientProps {
  initialData?: any[];
}

export default function UsersClient({ initialData }: UsersClientProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: users, isLoading, refetch } = useQuery({
    ...orpc.admin.getUsers.queryOptions(),
    initialData
  });

  const toggleBlockMutation = useMutation(orpc.admin.toggleUserBlock.mutationOptions());
  const changeRoleMutation = useMutation(orpc.admin.changeUserRole.mutationOptions());

  const handleRoleChange = async (userId: string, newRole: "STUDENT" | "INSTRUCTOR" | "ADMIN") => {
    try {
      await changeRoleMutation.mutateAsync({ userId, role: newRole });
      toast.success(`User role updated to ${newRole}`);
      setSelectedUser(null);
      refetch();
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  const handleToggleBlock = async (userId: string, isCurrentlyBlocked: boolean) => {
    try {
      await toggleBlockMutation.mutateAsync({
        userId,
        isBlocked: !isCurrentlyBlocked,
      });
      toast.success(isCurrentlyBlocked ? "User unblocked" : "User blocked");
      refetch();
    } catch (error) {
      toast.error("Action failed");
    }
  };

  // Client-side filtering and sorting (DataTable work)
  const processedUsers = useMemo(() => {
    if (!users) return [];
    
    let filtered = users.filter((u: any) => {
      const matchesSearch = 
        u.name.toLowerCase().includes(search.toLowerCase()) || 
        u.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesRole = !roleFilter || u.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });

    if (sortConfig) {
      filtered.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [users, search, roleFilter, sortConfig]);

  const totalPages = Math.ceil(processedUsers.length / itemsPerPage);
  const paginatedUsers = processedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">View, manage and moderate platform users.</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={roleFilter || ""}
            onChange={(e) => {
              setRoleFilter(e.target.value || undefined);
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-semibold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="STUDENT">Students</option>
            <option value="INSTRUCTOR">Instructors</option>
            <option value="ADMIN">Admins</option>
          </select>
          <div className="h-4 w-px bg-gray-100 mx-1" />
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest px-2 whitespace-nowrap">
            {processedUsers.length} Total
          </p>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-2">
                    User
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('createdAt')}>
                  <div className="flex items-center gap-2">
                    Joined
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right text-[12px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && !users ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4"><div className="h-10 bg-gray-50 rounded-xl w-full" /></td>
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <UserX size={32} className="text-gray-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-900 font-bold">No users found</p>
                        <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[14px] shadow-sm overflow-hidden shrink-0">
                          {u.image ? (
                            <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-gray-900 truncate">{u.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-gray-400">
                            <Mail size={12} />
                            <p className="text-[12px] font-medium truncate">{u.email}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors",
                        u.role === "ADMIN" ? "bg-rose-50 text-rose-600 border-rose-100" :
                        u.role === "INSTRUCTOR" ? "bg-violet-50 text-violet-600 border-violet-100" :
                        "bg-blue-50 text-blue-600 border-blue-100"
                      )}>
                        <Shield size={12} />
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                          <Ban size={12} />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <CheckCircle2 size={12} />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] font-medium text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedUser(u)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                          disabled={toggleBlockMutation.isPending || u.role === "ADMIN"}
                          className={cn(
                            "p-2 rounded-lg transition-all border border-transparent disabled:opacity-30",
                            u.isBlocked 
                              ? "text-emerald-500 hover:bg-emerald-50 hover:border-emerald-100" 
                              : "text-rose-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100"
                          )}
                          title={u.isBlocked ? "Unblock User" : "Block User"}
                        >
                          {u.isBlocked ? <Unlock size={18} /> : <Ban size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[12px] font-bold text-gray-400">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, processedUsers.length)} to {Math.min(currentPage * itemsPerPage, processedUsers.length)} of {processedUsers.length} users
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedUser(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header & Profile Pic - FIXED TOP */}
            <div className="relative shrink-0">
              <div className="h-32 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <button 
                onClick={() => setSelectedUser(null)} 
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl transition-colors text-white z-20"
              >
                <X size={20} />
              </button>
              <div className="px-8 relative -mt-16">
                <div className="w-32 h-32 rounded-[32px] bg-white p-1.5 shadow-xl inline-block relative z-10">
                  <div className="w-full h-full rounded-[26px] bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-4xl shadow-inner overflow-hidden">
                    {selectedUser.image ? (
                      <img src={selectedUser.image} alt={selectedUser.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedUser.name.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="px-8 pb-8 pt-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedUser.name}</h2>
                  <p className="text-gray-500 font-medium flex items-center gap-2 mt-1">
                    <Mail size={16} className="text-gray-400" />
                    {selectedUser.email}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* ... same content ... */}
                  <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Shield size={14} className="text-indigo-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider">Account Role</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-lg text-[13px] font-bold",
                      selectedUser.role === "ADMIN" ? "text-rose-600 bg-rose-50" :
                      selectedUser.role === "INSTRUCTOR" ? "text-violet-600 bg-violet-50" :
                      "text-blue-600 bg-blue-50"
                    )}>
                      {selectedUser.role}
                    </span>
                  </div>
                  <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100/50 space-y-1.5">
                    <div className="flex items-center gap-2 text-gray-400">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider">Current Status</p>
                    </div>
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-lg text-[13px] font-bold",
                      selectedUser.isBlocked ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50"
                    )}>
                      {selectedUser.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </div>

                  {/* Administrative Actions */}
                  <div className="col-span-2 p-5 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <GraduationCap size={14} className="text-indigo-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Administrative Actions</p>
                    </div>
                    <div className="flex gap-3">
                      {selectedUser.role === "STUDENT" && (
                        <button 
                          onClick={() => handleRoleChange(selectedUser.id, "INSTRUCTOR")}
                          disabled={changeRoleMutation.isPending}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[13px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                        >
                          <GraduationCap size={16} />
                          Make Instructor
                        </button>
                      )}
                      {selectedUser.role === "INSTRUCTOR" && (
                        <button 
                          onClick={() => handleRoleChange(selectedUser.id, "STUDENT")}
                          disabled={changeRoleMutation.isPending}
                          className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-bold text-[13px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                        >
                          <UserX size={16} />
                          Make Student
                        </button>
                      )}
                      <button 
                        onClick={() => handleToggleBlock(selectedUser.id, selectedUser.isBlocked)}
                        disabled={toggleBlockMutation.isPending || selectedUser.role === "ADMIN"}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold text-[13px] transition-all active:scale-[0.98] border shadow-sm flex items-center justify-center gap-2",
                          selectedUser.isBlocked 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" 
                            : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                        )}
                      >
                        {selectedUser.isBlocked ? <Unlock size={16} /> : <Ban size={16} />}
                        {selectedUser.isBlocked ? "Unblock" : "Block User"}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100/50 space-y-1.5 col-span-2">
                    <div className="flex items-center gap-2 text-gray-400">
                      <CheckCircle2 size={14} className="text-indigo-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider">Membership</p>
                    </div>
                    <p className="text-[15px] font-bold text-gray-700">
                      Member since {new Date(selectedUser.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold transition-all text-[15px] active:scale-[0.98]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
