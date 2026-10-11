import { useState } from "react";
import { Lock, Mail, User as UserIcon, Shield, UserCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import ConveneLogo from "./ConveneLogo";

type Mode = "login" | "signup";

export default function AuthPage() {
  const { login, signup, authNotice, clearAuthNotice } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    clearAuthNotice();

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(name.trim(), email, password, role);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 bg-slate-950 overflow-hidden">
      {/* Ambient GDG 4-Color Glow Orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#4285F4]/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-[#EA4335]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-[#34A853]/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-1/4 w-72 h-72 rounded-full bg-[#FBBC05]/10 blur-3xl" />

      <div className="relative w-full max-w-md py-8">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/90 ring-1 ring-[#4285F4]/40 mb-4 shadow-xl shadow-blue-500/15 overflow-hidden">
            <ConveneLogo className="w-12 h-12" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
            <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
            <span className="w-2 h-2 rounded-full bg-[#FBBC05]" />
            <span className="w-2 h-2 rounded-full bg-[#34A853]" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Convene</h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            {mode === "login"
              ? "Sign in to discover and manage events"
              : "Create an account to get started"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl ring-1 ring-slate-800 overflow-hidden shadow-2xl shadow-black/50">
          {/* Top GDG 4-color bar */}
          <div className="h-1.5 w-full gdg-gradient-bar" />

          <div className="p-8">
            {/* Session expired notice */}
            {authNotice && (
              <div className="mb-5 px-4 py-3 bg-[#FBBC05]/10 ring-1 ring-[#FBBC05]/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#FBBC05] shrink-0 mt-0.5" />
                <span>{authNotice}</span>
              </div>
            )}

            {/* Toggle */}
            <div className="flex gap-2 p-1.5 bg-slate-950/80 ring-1 ring-slate-800/80 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  clearAuthNotice();
                }}
                className={`btn-tactile flex-1 py-2.5 rounded-lg text-sm font-semibold ${
                  mode === "login"
                    ? "bg-gradient-to-r from-[#4285F4] to-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  clearAuthNotice();
                }}
                className={`btn-tactile flex-1 py-2.5 rounded-lg text-sm font-semibold ${
                  mode === "signup"
                    ? "bg-gradient-to-r from-[#34A853] to-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-700/80 focus:ring-2 focus:ring-[#34A853] focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-700/80 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-700/80 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                  />
                </div>
              </div>

              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Account Type
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRole("user")}
                      className={`btn-tactile flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                        role === "user"
                          ? "bg-[#4285F4]/20 ring-2 ring-[#4285F4] text-blue-300 shadow-md shadow-blue-500/20"
                          : "bg-slate-950/60 ring-1 ring-slate-700/80 text-slate-400 hover:text-white"
                      }`}
                    >
                      <UserCircle className="w-4 h-4" /> User
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("admin")}
                      className={`btn-tactile flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                        role === "admin"
                          ? "bg-[#FBBC05]/20 ring-2 ring-[#FBBC05] text-amber-300 shadow-md shadow-amber-500/20"
                          : "bg-slate-950/60 ring-1 ring-slate-700/80 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Shield className="w-4 h-4" /> Admin
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="px-4 py-2.5 bg-[#EA4335]/15 ring-1 ring-[#EA4335]/40 rounded-xl text-sm text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className={`btn-tactile w-full py-3 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg ${
                  mode === "login"
                    ? "bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/30"
                    : "bg-gradient-to-r from-[#34A853] to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/30"
                }`}
              >
                {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            {/* Demo credentials hint */}
            {mode === "login" && (
              <div className="mt-6 pt-5 border-t border-slate-800 text-xs text-slate-400 space-y-1.5">
                <p className="font-semibold text-slate-300">
                  Quick-fill Demo Accounts (password: <span className="text-white">password</span>):
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("alice@test.com");
                      setPassword("password");
                    }}
                    className="btn-tactile flex-1 py-1.5 px-3 rounded-lg bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-blue-300 ring-1 ring-[#4285F4]/30 font-medium text-center"
                  >
                    User: alice@test.com
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("admin@test.com");
                      setPassword("password");
                    }}
                    className="btn-tactile flex-1 py-1.5 px-3 rounded-lg bg-[#FBBC05]/15 hover:bg-[#FBBC05]/25 text-amber-300 ring-1 ring-[#FBBC05]/30 font-medium text-center"
                  >
                    Admin: admin@test.com
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
