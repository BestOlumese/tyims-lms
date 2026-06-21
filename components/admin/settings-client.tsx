"use client";

import { useState, useEffect } from "react";
import { useSession, authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc";
import { 
  User, 
  Mail, 
  Lock, 
  Save, 
  Loader2, 
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

export default function SettingsClient() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session]);

  const updateProfileMutation = useMutation(orpc.admin.updateProfile.mutationOptions());
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfileMutation.mutateAsync({ name });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    setIsChangingPassword(true);
    try {
      await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      }, {
        onSuccess: () => {
          toast.success("Password changed successfully");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || "Failed to change password");
        }
      });
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isSessionPending) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your administrative profile and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Section */}
        <div className="md:col-span-1">
          <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-wider">Profile Information</h2>
          <p className="text-[13px] text-gray-500 mt-1">Update your name and account details.</p>
        </div>
        
        <div className="md:col-span-2">
          <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-gray-700 ml-1">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-medium text-[14px]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={session?.user?.name || "Admin Name"}
                  />
                </div>
              </div>
              <div className="space-y-2 opacity-60">
                <label className="text-[13px] font-bold text-gray-700 ml-1">Email Address (Read-only)</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="email" 
                    disabled
                    className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-100 rounded-xl cursor-not-allowed font-medium text-[14px]"
                    value={session?.user?.email}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        <div className="col-span-full h-px bg-gray-100 my-4" />

        {/* Security Section */}
        <div className="md:col-span-1">
          <h2 className="text-[14px] font-bold text-gray-900 uppercase tracking-wider">Security & Password</h2>
          <p className="text-[13px] text-gray-500 mt-1">Ensure your account is using a long, random password to stay secure.</p>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-gray-700 ml-1">Current Password</label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type={showCurrent ? "text" : "password"}
                    required
                    className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-medium text-[14px]"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">New Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type={showNew ? "text" : "password"}
                      required
                      className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-medium text-[14px]"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Confirm Password</label>
                  <div className="relative">
                    <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type={showConfirm ? "text" : "password"}
                      required
                      className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-medium text-[14px]"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={20} />
              <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
                Changing your password will sign you out of all other sessions to ensure your account remains secure.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                disabled={isChangingPassword}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isChangingPassword ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
