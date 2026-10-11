import { LogOut, Ticket, BarChart3, Compass } from "lucide-react";
import { useAuth } from "../AuthContext";
import ConveneLogo from "./ConveneLogo";

export default function Header() {
  const { user, logout, activeTab, setActiveTab } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === "admin";

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-lg shadow-black/20">
      {/* GDG 4-Color Top Accent Strip */}
      <div className="h-1 w-full gdg-gradient-bar" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand + Navigation */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("events")}
            className="group flex items-center gap-3 text-left btn-tactile"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-950/90 ring-1 ring-slate-700/80 group-hover:ring-[#4285F4] transition-all shadow-md shadow-blue-500/15">
              <ConveneLogo className="w-7 h-7" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold tracking-tight text-lg">Convene</span>
                {/* GDG 4-color mini dots */}
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FBBC05]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
                </span>
              </div>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950/70 p-1 rounded-xl ring-1 ring-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className={`btn-tactile flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                activeTab === "events"
                  ? "bg-gradient-to-r from-[#4285F4] to-blue-500 text-white shadow-md shadow-blue-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{isAdmin ? "Manage Events" : "Browse Events"}</span>
            </button>

            {!isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab("my-registrations")}
                className={`btn-tactile flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                  activeTab === "my-registrations"
                    ? "bg-gradient-to-r from-[#34A853] to-emerald-500 text-white shadow-md shadow-emerald-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>My Registrations</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                className={`btn-tactile flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium ${
                  activeTab === "analytics"
                    ? "bg-gradient-to-r from-[#FBBC05] to-amber-400 text-slate-950 font-semibold shadow-md shadow-amber-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
            )}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5 sm:gap-4">

          {/* User info */}
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden lg:block">
              <div className="text-sm font-medium text-white leading-tight">{user.name}</div>
              <div className="text-xs text-slate-400">{user.email}</div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                isAdmin
                  ? "bg-[#FBBC05]/15 text-[#FBBC05] ring-1 ring-[#FBBC05]/40"
                  : "bg-[#4285F4]/15 text-[#4285F4] ring-1 ring-[#4285F4]/40"
              }`}
            >
              {isAdmin ? "Admin" : "Attendee"}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-[#EA4335]/20 hover:text-rose-300 ring-1 ring-slate-700/80 hover:ring-[#EA4335]/40"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
