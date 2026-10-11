import {
  X,
  Calendar,
  MapPin,
  Users,
  Tag,
  UserPlus,
  UserMinus,
  Pencil,
  Trash2,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { getCategoryTheme, type EventItem } from "../types";

interface Props {
  event: EventItem;
  busyEventId: string | null;
  onClose: () => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onEdit: (event: EventItem) => void;
  onDelete: (event: EventItem) => void;
  onViewAttendees: (event: EventItem) => void;
}

export default function EventDetailsModal({
  event,
  busyEventId,
  onClose,
  onJoin,
  onLeave,
  onEdit,
  onDelete,
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
  const isPast = eventDate < new Date();
  const isBusy = busyEventId === event._id;

  const attendeeCount = event.attendees.length;
  const capacity = event.capacity || 50;
  const spotsLeft = Math.max(0, capacity - attendeeCount);
  const isFull = attendeeCount >= capacity;
  const fillPercent = Math.min(100, Math.round((attendeeCount / capacity) * 100));

  const theme = getCategoryTheme(event.category);

  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-slate-900 rounded-2xl ring-1 ring-slate-800 shadow-2xl overflow-hidden my-8">
        <div className={`h-1.5 w-full ${theme.topBar}`} />

        <div className="p-6">
          {/* Header badges */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${theme.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                <Tag className="w-3.5 h-3.5" />
                {event.category || "Workshop"}
              </span>
              {isPast && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300">
                  Past Event
                </span>
              )}
              {isFull && !isPast && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EA4335]/15 text-rose-300 ring-1 ring-[#EA4335]/35">
                  Full Capacity
                </span>
              )}
              {isAttending && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#34A853]/15 text-emerald-300 ring-1 ring-[#34A853]/35">
                  <UserCheck className="w-3.5 h-3.5" />
                  Registered
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-tactile text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-4">{event.title}</h2>

          {/* Key info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-950/70 rounded-xl p-3.5 ring-1 ring-slate-800 flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#4285F4] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400">Date & Time</div>
                <div className="text-sm font-semibold text-white">{formattedDate}</div>
                <div className="text-xs text-slate-300">{formattedTime}</div>
              </div>
            </div>

            <div className="bg-slate-950/70 rounded-xl p-3.5 ring-1 ring-slate-800 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#34A853] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-400">Venue</div>
                <div className="text-sm font-semibold text-white">
                  {event.venue || "Main Auditorium, Tech Hub"}
                </div>
                <div className="text-xs text-slate-400">
                  Organized by {event.createdBy?.name || "Admin"}
                </div>
              </div>
            </div>
          </div>

          {/* Capacity progress */}
          <div className="bg-slate-950/70 rounded-xl p-4 ring-1 ring-slate-800 mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2 text-slate-300 font-medium">
                <Users className="w-4 h-4 text-[#4285F4]" />
                Registration Capacity
              </span>
              <span className="text-slate-300">
                <strong className="text-white">{attendeeCount}</strong> / {capacity} registered (
                {isFull ? (
                  <span className="text-[#EA4335] font-semibold">0 spots left</span>
                ) : (
                  <span className="text-[#34A853] font-semibold">{spotsLeft} spots left</span>
                )}
                )
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
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

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              About This Event
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            {!isAdmin && !isPast && (
              <>
                {isAttending ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onLeave(event._id)}
                    className="btn-tactile flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-[#EA4335]/20 hover:text-rose-200 disabled:opacity-50 text-white ring-1 ring-slate-700"
                  >
                    <UserMinus className="w-4 h-4" />
                    {isBusy ? "Processing…" : "Unregister"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy || isFull}
                    onClick={() => onJoin(event._id)}
                    className="btn-tactile flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-500/25"
                  >
                    <UserPlus className="w-4 h-4" />
                    {isBusy ? "Registering…" : isFull ? "Event Full" : "Register Now"}
                  </button>
                )}
              </>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewAttendees(event);
                  }}
                  className="btn-tactile flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[#34A853]/15 hover:bg-[#34A853]/25 text-emerald-300 ring-1 ring-[#34A853]/35"
                >
                  <ClipboardList className="w-4 h-4" />
                  View Attendees ({attendeeCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(event);
                  }}
                  className="btn-tactile flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-blue-300 ring-1 ring-[#4285F4]/35"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete(event);
                  }}
                  className="btn-tactile flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[#EA4335]/15 hover:bg-[#EA4335]/25 text-rose-300 ring-1 ring-[#EA4335]/35"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
