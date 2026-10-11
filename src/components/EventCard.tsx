import {
  Users,
  Trash2,
  UserPlus,
  UserMinus,
  MapPin,
  Tag,
  Pencil,
  ClipboardList,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { getCategoryTheme, type EventItem } from "../types";

interface Props {
  event: EventItem;
  busyEventId: string | null;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onEdit: (event: EventItem) => void;
  onDelete: (event: EventItem) => void;
  onViewDetails: (event: EventItem) => void;
  onViewAttendees: (event: EventItem) => void;
}

export default function EventCard({
  event,
  busyEventId,
  onJoin,
  onLeave,
  onEdit,
  onDelete,
  onViewDetails,
  onViewAttendees,
}: Props) {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const isAttending = event.attendees.some(
    (a) =>
      String(a._id) === String(user.id) ||
      Boolean(a.email && user.email && a.email.toLowerCase() === user.email.toLowerCase())
  );
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const isPast = eventDate < new Date();
  const isBusy = busyEventId === event._id;
  const attendeeCount = event.attendees.length;
  const capacity = event.capacity || 50;
  const spotsRemaining = Math.max(0, capacity - attendeeCount);
  const isFull = attendeeCount >= capacity;
  const fillPercent = Math.min(100, Math.round((attendeeCount / capacity) * 100));

  const theme = getCategoryTheme(event.category);

  return (
    <div
      className={`group card-interactive bg-slate-900/75 backdrop-blur-sm rounded-2xl ring-1 ring-slate-800 ${theme.cardHover} overflow-hidden flex flex-col`}
    >
      {/* Category-colored GDG top bar */}
      <div className={`h-1.5 w-full ${theme.topBar}`} />

      {/* Top header + Date badge */}
      <div className="relative p-5 pb-0">
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${theme.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
            <Tag className="w-3 h-3" />
            {event.category || "Workshop"}
          </span>

          <div className="flex items-center gap-1.5">
            {isPast && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-400 ring-1 ring-slate-700">
                Past
              </span>
            )}
            {!isPast && isFull && (
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#EA4335]/15 text-rose-300 ring-1 ring-[#EA4335]/40">
                Full
              </span>
            )}
            {isAttending && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[#34A853]/15 text-emerald-300 ring-1 ring-[#34A853]/40">
                <CheckCircle2 className="w-3 h-3" />
                Registered
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-slate-950/90 ring-1 ring-slate-700/80 shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-inner">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.dateAccent}`}>
              {eventDate.toLocaleDateString("en-US", { month: "short" })}
            </span>
            <span className="text-xl font-extrabold text-white leading-none mt-0.5">
              {eventDate.getDate()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onViewDetails(event)}
              className="text-left text-lg font-bold text-white group-hover:text-[#4285F4] transition-colors leading-tight line-clamp-1"
            >
              {event.title}
            </button>
            <p className="text-xs text-slate-400 mt-0.5">
              {formattedDate} · {formattedTime}
            </p>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#34A853] shrink-0" />
              <span className="truncate">{event.venue || "Main Auditorium, Tech Hub"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 flex flex-col">
        <p className="text-sm text-slate-400 leading-relaxed mb-4 line-clamp-2 flex-1">
          {event.description}
        </p>

        {/* Capacity & Attendees bar */}
        <div className="mb-4 bg-slate-950/60 rounded-xl p-3 ring-1 ring-slate-800/90">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Users className="w-3.5 h-3.5 text-[#4285F4]" />
              <span className="font-bold text-white">{attendeeCount}</span> / {capacity} spots
            </span>
            <span
              className={`font-semibold ${
                isFull
                  ? "text-[#EA4335]"
                  : spotsRemaining <= 5
                  ? "text-[#FBBC05]"
                  : "text-[#34A853]"
              }`}
            >
              {isFull ? "No spots left" : `${spotsRemaining} available`}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFull
                  ? "bg-gradient-to-r from-[#EA4335] to-rose-400"
                  : fillPercent >= 80
                  ? "bg-gradient-to-r from-[#FBBC05] to-amber-400"
                  : "bg-gradient-to-r from-[#4285F4] to-[#34A853]"
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>

        {/* Creator + Details link */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
          <span>
            By <span className="text-slate-300 font-medium">{event.createdBy?.name || "Admin"}</span>
          </span>
          <button
            type="button"
            onClick={() => onViewDetails(event)}
            className="btn-tactile inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-[#4285F4] hover:text-blue-300 font-semibold ring-1 ring-slate-700/70"
          >
            <Eye className="w-3.5 h-3.5" /> Details
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {/* User actions: Register / Unregister */}
          {!isAdmin && !isPast && (
            <>
              {isAttending ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onLeave(event._id)}
                  className="btn-tactile flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-[#EA4335]/20 hover:text-rose-200 disabled:opacity-50 text-slate-200 ring-1 ring-slate-700 hover:ring-[#EA4335]/40"
                >
                  <UserMinus className="w-4 h-4" />
                  {isBusy ? "Updating…" : "Unregister"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusy || isFull}
                  onClick={() => onJoin(event._id)}
                  className="btn-tactile flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-500/25"
                >
                  <UserPlus className="w-4 h-4" />
                  {isBusy ? "Registering…" : isFull ? "Event Full" : "Register Now"}
                </button>
              )}
            </>
          )}

          {/* Admin actions: Attendees, Edit, Delete */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => onViewAttendees(event)}
                title="View Registered Attendees"
                className="btn-tactile flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-[#34A853]/15 hover:bg-[#34A853]/25 text-emerald-300 ring-1 ring-[#34A853]/35 shadow-sm"
              >
                <ClipboardList className="w-3.5 h-3.5" /> Attendees ({attendeeCount})
              </button>
              <button
                type="button"
                onClick={() => onEdit(event)}
                title="Edit Event"
                className="btn-tactile flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-blue-300 ring-1 ring-[#4285F4]/35 shadow-sm"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(event)}
                title="Delete Event"
                className="btn-tactile flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-[#EA4335]/15 hover:bg-[#EA4335]/25 text-rose-300 ring-1 ring-[#EA4335]/35 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
