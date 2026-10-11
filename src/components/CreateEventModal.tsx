import { useState } from "react";
import { X, Calendar, Type, AlignLeft, MapPin, Users, Tag } from "lucide-react";
import { EVENT_CATEGORIES, type EventFormData, type EventItem } from "../types";

interface Props {
  initialEvent?: EventItem | null;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
}

function toDatetimeLocalValue(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function CreateEventModal({ initialEvent, onClose, onSave }: Props) {
  const isEditing = Boolean(initialEvent);

  const [title, setTitle] = useState(initialEvent?.title || "");
  const [description, setDescription] = useState(initialEvent?.description || "");
  const [date, setDate] = useState(
    initialEvent?.date ? toDatetimeLocalValue(initialEvent.date) : ""
  );
  const [venue, setVenue] = useState(initialEvent?.venue || "");
  const [capacity, setCapacity] = useState<string>(
    initialEvent?.capacity ? String(initialEvent.capacity) : "50"
  );
  const [category, setCategory] = useState<string>(
    initialEvent?.category || EVENT_CATEGORIES[0]
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedVenue = venue.trim();
    const parsedCapacity = Number(capacity);

    if (!trimmedTitle) {
      setError("Event title is required.");
      return;
    }
    if (!trimmedDesc) {
      setError("Event description is required.");
      return;
    }
    if (!date || Number.isNaN(new Date(date).getTime())) {
      setError("Please select a valid date and time.");
      return;
    }
    if (!trimmedVenue) {
      setError("Event venue is required.");
      return;
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      setError("Capacity must be a whole number of at least 1.");
      return;
    }
    if (
      initialEvent &&
      parsedCapacity < initialEvent.attendees.length
    ) {
      setError(
        `Capacity cannot be less than current registered attendees (${initialEvent.attendees.length}).`
      );
      return;
    }
    if (!category) {
      setError("Please select a category.");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        title: trimmedTitle,
        description: trimmedDesc,
        date: new Date(date).toISOString(),
        venue: trimmedVenue,
        capacity: parsedCapacity,
        category,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to ${isEditing ? "update" : "create"} event`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl ring-1 ring-slate-800 shadow-2xl overflow-hidden my-8">
        <div className="h-1.5 w-full gdg-gradient-bar" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isEditing ? "Edit Event" : "Create New Event"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing
                  ? "Update the event details below. Changes apply immediately."
                  : "Fill in all details to publish a new event."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Event Title</label>
              <div className="relative">
                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="React Workshop"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Category + Capacity row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                  >
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900 text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Capacity</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    required
                    min={initialEvent ? Math.max(1, initialEvent.attendees.length) : 1}
                    max={100000}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="50"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Venue */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Venue</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Main Auditorium, Tech Hub"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Date & Time */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Date & Time</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <div className="relative">
                <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this event about?"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 rounded-xl text-white placeholder-slate-500 ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-2.5 bg-[#EA4335]/15 ring-1 ring-[#EA4335]/40 rounded-xl text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-tactile flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 ring-1 ring-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-tactile flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white shadow-lg shadow-blue-500/25"
              >
                {busy
                  ? isEditing
                    ? "Saving…"
                    : "Creating…"
                  : isEditing
                  ? "Save Changes"
                  : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
