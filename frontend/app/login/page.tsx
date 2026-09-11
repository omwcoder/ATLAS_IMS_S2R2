"use client";
export const dynamic = "force-dynamic";
// app/login/page.tsx
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Clock } from "lucide-react";
import { login, isLoggedIn } from "@/lib/api";

// Wrapped in Suspense so useSearchParams works correctly in Next.js 14
function LoginForm() {
  const router       = useSearchParams();
  const reason       = router.get("reason");
  const isInactivity = reason === "inactivity";

  const nav                          = useRouter();
  const [username, setUsername]      = useState("");
  const [password, setPassword]      = useState("");
  const [showPwd,  setShowPwd]       = useState(false);
  const [error,    setError]         = useState("");
  const [loading,  setLoading]       = useState(false);

  useEffect(() => {
    if (isLoggedIn()) nav.replace("/");
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      nav.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      // Show the real error — helps diagnose network vs credential issues
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("401") || msg.toLowerCase().includes("credentials")) {
        setError("Invalid username or password. Please check and try again.");
      } else {
        setError(`Login failed: ${msg}. Check your connection and try again.`);
      }
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1e40af 0%, #0ea5e9 50%, #06b6d4 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #22d3ee, transparent)" }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 space-y-6
                        border border-white/20 dark:border-gray-700/60 backdrop-blur-sm">

          {/* Logo + branding */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg ring-4 ring-blue-100 dark:ring-blue-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/s2r2-logo.png"
                alt="S2R2 Technologies"
                className="w-full h-full object-contain bg-white p-1"
              />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                S2R2 Inventory
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Sign in to your workspace
              </p>
            </div>
          </div>

          {/* Inactivity notice */}
          {isInactivity && (
            <div className="flex items-start gap-2.5 text-sm text-amber-800 dark:text-amber-300
                            bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700
                            rounded-xl px-4 py-3">
              <Clock size={15} className="shrink-0 mt-0.5" />
              <span>
                You were signed out after <span className="font-semibold">10 minutes of inactivity</span>.
                Please sign in again to continue.
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400
                            bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                            rounded-xl px-4 py-3">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="Enter your username"
                className="form-input"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="form-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-6
                         rounded-xl font-bold text-sm text-white transition-all
                         disabled:opacity-60 disabled:cursor-not-allowed
                         active:scale-[0.98] shadow-lg shadow-blue-500/30"
              style={{ background: loading ? "#93c5fd" : "linear-gradient(90deg, #2563eb, #0ea5e9)" }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
