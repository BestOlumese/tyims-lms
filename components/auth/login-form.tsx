"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn.email(
        { email, password, callbackURL: "/" },
        {
          onSuccess: () => {
            toast.success("Welcome back!");
            router.push("/");
            router.refresh();
          },
          onError: (ctx) => {
            toast.error(ctx.error.message || "Invalid credentials");
          },
        }
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Sign in to LMS Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your credentials to continue
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 text-gray-900 transition-shadow"
                placeholder="admin@lms.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="block w-full px-3 py-2 pr-10 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 text-gray-900 transition-shadow"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* Seed accounts info */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Test Accounts
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-mono text-xs">admin@lms.com</span>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                Admin
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-mono text-xs">instructor@lms.com</span>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                Instructor
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
            Password: <span className="font-mono">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
