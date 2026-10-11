import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { EventItem } from "../types";

interface Props {
  event: EventItem;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export default function ConfirmDeleteModal({ event, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setError("");
    setBusy(true);
    try {
      await onConfirm(event._id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete event.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-800 rounded-2xl ring-1 ring-slate-700 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 ring-1 ring-red-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Delete Event</h3>
              <p className="text-xs text-slate-400">This action cannot be undone.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-white">"{event.title}"</span>?
          {event.attendees.length > 0 && (
            <span className="block mt-1.5 text-xs text-amber-300">
              Warning: {event.attendees.length} registered{" "}
              {event.attendees.length === 1 ? "attendee" : "attendees"} will be removed from this
              event.
            </span>
          )}
        </p>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 bg-red-500/10 ring-1 ring-red-500/30 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-700/60 hover:bg-slate-700 text-slate-300 ring-1 ring-slate-600 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white shadow-lg shadow-red-500/20 transition-all"
          >
            {busy ? "Deleting…" : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
