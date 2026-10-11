import { useEffect, useState } from "react";
import { X, Users, Mail, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../AuthContext";
import type { AttendeeRegistrationItem, EventItem } from "../types";

interface Props {
  event: EventItem;
  onClose: () => void;
}

export default function AttendeesModal({ event, onClose }: Props) {
  const { eventsApi } = useAuth();
  const [registrations, setRegistrations] = useState<AttendeeRegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    eventsApi
      .getEventRegistrations(event._id)
      .then((res) => {
        if (!active) return;
        setRegistrations(res.registrations || []);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || "Failed to load attendee list.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [event._id, eventsApi]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-800 rounded-2xl ring-1 ring-slate-700 shadow-2xl p-6 my-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-teal-400 mb-1">
              <Users className="w-4 h-4" />
              Admin Attendee List
            </div>
            <h2 className="text-xl font-bold text-white">{event.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {registrations.length} / {event.capacity || 50} spots registered ·{" "}
              {event.venue || "Main Auditorium, Tech Hub"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading registered attendees…</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl flex items-center gap-3 text-sm text-red-300">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : registrations.length === 0 ? (
          <div className="py-12 text-center bg-slate-900/40 rounded-xl ring-1 ring-slate-700/50">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 font-medium">No attendees registered yet</p>
            <p className="text-xs text-slate-500 mt-1">
              When users register for this event, their details will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-700/70 bg-slate-900/50">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/70 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-900/80">
                  <th className="py-3 px-4">Attendee</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Registered At</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {registrations.map((reg) => {
                  const regDate = new Date(reg.registeredAt);
                  const dateStr = Number.isNaN(regDate.getTime())
                    ? "—"
                    : regDate.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      });

                  return (
                    <tr key={reg._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center text-xs font-bold text-white">
                            {reg.attendeeName?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <span>{reg.attendeeName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {reg.attendeeEmail}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {dateStr}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 capitalize">
                          <CheckCircle2 className="w-3 h-3" />
                          {reg.status || "confirmed"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
