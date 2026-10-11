import { X, QrCode, CalendarDays, MapPin, CheckCircle2, User as UserIcon, Download } from "lucide-react";
import { getCategoryTheme, type EventItem, type User } from "../types";

interface Props {
  event: EventItem;
  user: User;
  registeredAt?: string;
  onClose: () => void;
}

// Deterministic 21x21 QR-style matrix generator from ticket payload string
function generateQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function drawFinder(rowOffset: number, colOffset: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rowOffset + r][colOffset + c] = isBorder || isInner;
        reserved[rowOffset + r][colOffset + c] = true;
      }
    }
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const rr = rowOffset + i;
        const cc = colOffset + j;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    reserved[6][i] = true;
    grid[i][6] = i % 2 === 0;
    reserved[i][6] = true;
  }

  // Deterministic hash stream from payload
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let seed = hash >>> 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        grid[r][c] = ((seed >>> 16) & 1) === 1;
      }
    }
  }

  return grid;
}

export default function QrTicketModal({ event, user, registeredAt, onClose }: Props) {
  const theme = getCategoryTheme(event.category);
  const ticketId = `GDG-${event._id.slice(-5).toUpperCase()}-${user.id.slice(-4).toUpperCase()}`;
  const qrPayload = JSON.stringify({
    ticketId,
    eventId: event._id,
    eventTitle: event.title,
    attendee: user.email,
  });

  const matrix = generateQrMatrix(qrPayload);
  const evDate = new Date(event.date);

  function handleDownloadCalendarReminder() {
    const start = evDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endDate = new Date(evDate.getTime() + 2 * 60 * 60 * 1000);
    const end = endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//GDG Event Manager//EN",
      "BEGIN:VEVENT",
      `UID:${ticketId}@gdg-events`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description.replace(/\n/g, " ")} (Ticket ID: ${ticketId})`,
      `LOCATION:${event.venue || "Main Auditorium, Tech Hub"}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT60M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Event Reminder",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-reminder.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl ring-1 ring-slate-800 shadow-2xl overflow-hidden my-8">
        {/* Top GDG 4-Color Bar */}
        <div className="h-2 w-full gdg-gradient-bar" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#34A853]/15 text-emerald-300 ring-1 ring-[#34A853]/35">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmed Entry Pass
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl font-extrabold text-white leading-snug">{event.title}</h3>
          <span
            className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${theme.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
            {event.category || "Workshop"}
          </span>

          {/* QR Code Box */}
          <div className="my-6 flex flex-col items-center justify-center bg-white p-5 rounded-2xl shadow-inner mx-auto max-w-[230px]">
            <svg
              viewBox="0 0 21 21"
              className="w-44 h-44"
              shapeRendering="crispEdges"
              aria-label="Event Registration QR Code"
            >
              {matrix.map((row, rIdx) =>
                row.map((cell, cIdx) =>
                  cell ? (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={cIdx}
                      y={rIdx}
                      width={1}
                      height={1}
                      fill="#0f172a"
                    />
                  ) : null
                )
              )}
            </svg>
            <div className="mt-2.5 text-center">
              <div className="text-[11px] font-mono font-bold tracking-widest text-slate-900">
                {ticketId}
              </div>
              <div className="text-[10px] text-slate-500">Scan at venue check-in</div>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="bg-slate-950/80 rounded-2xl p-4 ring-1 ring-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-[#4285F4]" />
                Attendee
              </span>
              <span className="text-white font-semibold">
                {user.name} ({user.email})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-[#FBBC05]" />
                Date & Time
              </span>
              <span className="text-white font-medium">
                {evDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                ·{" "}
                {evDate.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#34A853]" />
                Venue
              </span>
              <span className="text-white font-medium truncate max-w-[200px]">
                {event.venue || "Main Auditorium, Tech Hub"}
              </span>
            </div>

            {registeredAt && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>Registered On</span>
                <span>{new Date(registeredAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 mt-5">
            <button
              type="button"
              onClick={handleDownloadCalendarReminder}
              className="btn-tactile flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-[#4285F4]/15 hover:bg-[#4285F4]/25 text-blue-300 ring-1 ring-[#4285F4]/35"
            >
              <Download className="w-3.5 h-3.5" />
              Save Reminder (.ics)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile py-2.5 px-5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white ring-1 ring-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
