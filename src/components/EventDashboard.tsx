import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  CalendarDays,
  Users,
  TrendingUp,
  Sparkles,
  Search,
  X,
  Ticket,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  ClipboardList,
  Eye,
  UserMinus,
  QrCode,
  BellRing,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import {
  EVENT_CATEGORIES,
  getCategoryTheme,
  type EventFormData,
  type EventItem,
  type UserRegistrationItem,
} from "../types";
import EventCard from "./EventCard";
import CreateEventModal from "./CreateEventModal";
import EventDetailsModal from "./EventDetailsModal";
import AttendeesModal from "./AttendeesModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import QrTicketModal from "./QrTicketModal";

export default function EventDashboard() {
  const { user, activeTab, setActiveTab, eventsApi } = useAuth();

  // Events state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & category filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // My Registrations state (for regular users)
  const [myRegistrations, setMyRegistrations] = useState<UserRegistrationItem[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<EventItem | null>(null);
  const [attendeesEvent, setAttendeesEvent] = useState<EventItem | null>(null);
  const [qrTicketEvent, setQrTicketEvent] = useState<{
    event: EventItem;
    registeredAt?: string;
  } | null>(null);

  // Action busy + toast state
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function flash(text: string, type: "success" | "error" = "success") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3200);
  }

  function broadcastEventSync() {
    try {
      localStorage.setItem("convene_events_sync", String(Date.now()));
    } catch {
      // Ignore storage quota/privacy errors
    }
  }

  const loadEvents = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await eventsApi.getEvents();
        setEvents(data);
        setDetailsEvent((prev) =>
          prev ? data.find((e) => e._id === prev._id) || null : null
        );
      } catch (err: any) {
        if (!silent) {
          setError(err.message || "Failed to load events.");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [eventsApi]
  );

  const loadMyRegistrations = useCallback(async () => {
    if (!user || user.role === "admin") return;
    setRegLoading(true);
    setRegError(null);
    try {
      const data = await eventsApi.getMyRegistrations();
      setMyRegistrations(data);
    } catch (err: any) {
      setRegError(err.message || "Failed to load your registrations.");
    } finally {
      setRegLoading(false);
    }
  }, [eventsApi, user]);

  // Initial load on mount / HMR update
  useEffect(() => {
    loadEvents(false);
  }, [loadEvents, user?.id]);

  useEffect(() => {
    if (activeTab === "my-registrations") {
      loadMyRegistrations();
    }
  }, [activeTab, loadMyRegistrations, user?.id]);

  // Real-time multi-tab & window-focus synchronization:
  // Whenever another tab registers/unregisters/edits an event, or when the user
  // switches back to this tab, silently refresh event counts (e.g. 0/1 -> 1/1).
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === "convene_events_sync") {
        loadEvents(true);
        if (activeTab === "my-registrations") {
          loadMyRegistrations();
        }
      }
    };

    const handleTabFocus = () => {
      if (document.visibilityState === "visible") {
        loadEvents(true);
      }
    };

    window.addEventListener("storage", handleStorageSync);
    window.addEventListener("focus", handleTabFocus);
    document.addEventListener("visibilitychange", handleTabFocus);

    return () => {
      window.removeEventListener("storage", handleStorageSync);
      window.removeEventListener("focus", handleTabFocus);
      document.removeEventListener("visibilitychange", handleTabFocus);
    };
  }, [loadEvents, loadMyRegistrations, activeTab]);

  // Client-side search (title, venue, category, description) & category filter
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesCat =
        selectedCategory === "All" || (ev.category || "Workshop") === selectedCategory;
      if (!matchesCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        ev.title.toLowerCase().includes(q) ||
        (ev.venue || "").toLowerCase().includes(q) ||
        (ev.category || "").toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q)
      );
    });
  }, [events, selectedCategory, searchQuery]);

  async function handleJoin(id: string) {
    setBusyEventId(id);
    try {
      await eventsApi.joinEvent(id);
      flash("Successfully registered! View your QR Pass under My Registrations.", "success");
      await Promise.all([
        loadEvents(true),
        activeTab === "my-registrations" ? loadMyRegistrations() : Promise.resolve(),
      ]);
      broadcastEventSync();
    } catch (err: any) {
      flash(err.message || "Failed to register for event", "error");
      // Always refresh event counts even on error (e.g. if another user just filled the last spot)
      await loadEvents(true);
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleLeave(id: string) {
    setBusyEventId(id);
    try {
      await eventsApi.leaveEvent(id);
      flash("You have unregistered from the event.", "success");
      await Promise.all([
        loadEvents(true),
        activeTab === "my-registrations" ? loadMyRegistrations() : Promise.resolve(),
      ]);
      broadcastEventSync();
    } catch (err: any) {
      flash(err.message || "Failed to unregister from event", "error");
      await loadEvents(true);
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleCreate(data: EventFormData) {
    const created = await eventsApi.createEvent(data);
    setEvents((prev) =>
      [...prev, created].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    );
    broadcastEventSync();
    flash("Event created successfully!", "success");
  }

  async function handleUpdate(data: EventFormData) {
    if (!editingEvent) return;
    const updated = await eventsApi.updateEvent(editingEvent._id, data);
    setEvents((prev) =>
      prev
        .map((e) => (e._id === updated._id ? updated : e))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );
    setDetailsEvent((prev) => (prev && prev._id === updated._id ? updated : prev));
    broadcastEventSync();
    flash("Event updated successfully!", "success");
  }

  async function handleDeleteConfirm(id: string) {
    await eventsApi.deleteEvent(id);
    setEvents((prev) => prev.filter((e) => e._id !== id));
    if (detailsEvent?._id === id) setDetailsEvent(null);
    broadcastEventSync();
    flash("Event deleted.", "success");
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";

  // Stats & Next Upcoming Event Reminder
  const now = new Date();
  const upcomingCount = events.filter((e) => new Date(e.date) >= now).length;
  const totalAttendees = events.reduce((sum, e) => sum + e.attendees.length, 0);
  const myUpcomingRegisteredEvents = events
    .filter((e) => e.attendees.some((a) => a._id === user.id) && new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const myEventsCount = events.filter((e) =>
    e.attendees.some((a) => a._id === user.id)
  ).length;
  const nextReminderEvent = !isAdmin ? myUpcomingRegisteredEvents[0] || null : null;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Subtle GDG 4-Color Ambient Background Glows */}
      <div className="pointer-events-none fixed top-0 left-1/4 w-96 h-96 rounded-full bg-[#4285F4]/10 blur-3xl" />
      <div className="pointer-events-none fixed top-32 right-1/4 w-96 h-96 rounded-full bg-[#34A853]/8 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 ring-1 ring-slate-800 mb-3">
            <Sparkles className="w-4 h-4 text-[#FBBC05]" />
            <span className="text-xs font-semibold text-slate-300">
              {isAdmin ? "GDG Admin Control Center" : "GDG Attendee Portal"}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="text-slate-400 mt-2">
            {isAdmin
              ? "Create, edit, and manage events, monitor capacity, and inspect attendee registrations."
              : "Discover upcoming events, register with one click, and access your QR entry passes."}
          </p>
        </div>

        {/* Upcoming Event Reminder Banner (Bonus: Event Reminders + QR Code Pass) */}
        {nextReminderEvent && (
          <div className="mb-6 bg-gradient-to-r from-[#4285F4]/15 via-slate-900/90 to-[#34A853]/15 rounded-2xl ring-1 ring-[#4285F4]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-blue-500/10">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#FBBC05]/20 ring-1 ring-[#FBBC05]/40 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 text-[#FBBC05]" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#FBBC05]">
                  Upcoming Event Reminder
                </div>
                <div className="text-sm text-white font-semibold mt-0.5">
                  You are registered for{" "}
                  <span className="text-blue-300 underline decoration-blue-400/50">
                    {nextReminderEvent.title}
                  </span>{" "}
                  on{" "}
                  {new Date(nextReminderEvent.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  at {nextReminderEvent.venue || "Main Auditorium, Tech Hub"}.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setQrTicketEvent({ event: nextReminderEvent })}
                className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#34A853] to-emerald-500 text-white shadow-md shadow-emerald-500/25"
              >
                <QrCode className="w-3.5 h-3.5" />
                View QR Pass
              </button>
            </div>
          </div>
        )}

        {/* Stats row — Styled with GDG Blue, Green, and Yellow accents */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* GDG Blue Stat */}
          <div className="card-interactive bg-slate-900/75 rounded-2xl ring-1 ring-slate-800 hover:ring-[#4285F4]/50 hover:shadow-xl hover:shadow-blue-500/10 overflow-hidden">
            <div className="h-1 w-full bg-[#4285F4]" />
            <div className="p-5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#4285F4]/15 ring-1 ring-[#4285F4]/30 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-[#4285F4]" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">{upcomingCount}</div>
                <div className="text-xs font-medium text-slate-400">Upcoming Events</div>
              </div>
            </div>
          </div>

          {/* GDG Green Stat */}
          <div className="card-interactive bg-slate-900/75 rounded-2xl ring-1 ring-slate-800 hover:ring-[#34A853]/50 hover:shadow-xl hover:shadow-emerald-500/10 overflow-hidden">
            <div className="h-1 w-full bg-[#34A853]" />
            <div className="p-5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#34A853]/15 ring-1 ring-[#34A853]/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#34A853]" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">{totalAttendees}</div>
                <div className="text-xs font-medium text-slate-400">Total Registrations</div>
              </div>
            </div>
          </div>

          {/* GDG Yellow Stat */}
          <div className="card-interactive bg-slate-900/75 rounded-2xl ring-1 ring-slate-800 hover:ring-[#FBBC05]/50 hover:shadow-xl hover:shadow-amber-500/10 overflow-hidden">
            <div className="h-1 w-full bg-[#FBBC05]" />
            <div className="p-5 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#FBBC05]/15 ring-1 ring-[#FBBC05]/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#FBBC05]" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">
                  {isAdmin ? events.length : myEventsCount}
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {isAdmin ? "Total Events Managed" : "My Registered Events"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: BROWSE / MANAGE EVENTS                                */}
        {/* ============================================================ */}
        {activeTab === "events" && (
          <>
            {/* Role-specific action bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isAdmin ? "All Events" : "Available Events"}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {isAdmin
                    ? "Create new events, edit existing ones, or view registered attendees."
                    : "Search or filter by category. Click any event for full details."}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="btn-tactile inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-500/30"
                >
                  <Plus className="w-4 h-4" /> New Event
                </button>
              )}
            </div>

            {/* Search & Category Filter Bar */}
            <div className="bg-slate-900/75 rounded-2xl ring-1 ring-slate-800 p-4 mb-6 space-y-3.5 shadow-lg shadow-black/20">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events by title, venue, or category…"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 rounded-xl text-sm text-white placeholder-slate-500 ring-1 ring-slate-800 focus:ring-2 focus:ring-[#4285F4] focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="btn-tactile absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category pills with GDG color dots */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {["All", ...EVENT_CATEGORIES].map((cat) => {
                  const active = selectedCategory === cat;
                  const theme = getCategoryTheme(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`btn-tactile inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap ${
                        active
                          ? cat === "All"
                            ? "bg-gradient-to-r from-[#4285F4] to-blue-500 text-white shadow-md shadow-blue-500/30"
                            : theme.activePill
                          : "bg-slate-950/70 text-slate-400 hover:text-white ring-1 ring-slate-800 hover:ring-slate-700"
                      }`}
                    >
                      {cat !== "All" && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            active ? "bg-current" : theme.dot
                          }`}
                        />
                      )}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role badge banner */}
            <div
              className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-2 ${
                isAdmin
                  ? "bg-[#FBBC05]/10 ring-1 ring-[#FBBC05]/30 text-amber-300"
                  : "bg-[#4285F4]/10 ring-1 ring-[#4285F4]/30 text-blue-300"
              }`}
            >
              <div>
                {isAdmin ? (
                  <>
                    <span className="font-semibold">Admin mode:</span> You can create, edit, and
                    delete events, and inspect each event's attendee list.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Attendee mode:</span> Browse events, register or
                    unregister, and access your QR entry tickets under{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("my-registrations")}
                      className="underline font-bold hover:text-white transition-colors"
                    >
                      My Registrations
                    </button>
                    .
                  </>
                )}
              </div>
            </div>

            {/* Event grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-slate-900/50 rounded-2xl ring-1 ring-slate-800 p-5 animate-pulse h-72"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 bg-[#EA4335]/10 ring-1 ring-[#EA4335]/30 rounded-2xl text-center">
                <AlertCircle className="w-10 h-10 text-[#EA4335] mx-auto mb-2" />
                <p className="text-rose-300 font-medium">{error}</p>
                <button
                  type="button"
                  onClick={() => loadEvents(false)}
                  className="btn-tactile mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#EA4335]/20 hover:bg-[#EA4335]/30 text-rose-200"
                >
                  Retry
                </button>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-2xl ring-1 ring-slate-800">
                <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 text-lg font-medium">
                  {events.length === 0 ? "No events available yet" : "No matching events found"}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  {events.length === 0
                    ? isAdmin
                      ? "Click 'New Event' to publish the first event."
                      : "Check back soon for upcoming events."
                    : "Try clearing your search query or selecting a different category."}
                </p>
                {(searchQuery || selectedCategory !== "All") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                    }}
                    className="btn-tactile mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 ring-1 ring-slate-700"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    busyEventId={busyEventId}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onEdit={(ev) => setEditingEvent(ev)}
                    onDelete={(ev) => setDeletingEvent(ev)}
                    onViewDetails={(ev) => setDetailsEvent(ev)}
                    onViewAttendees={(ev) => setAttendeesEvent(ev)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* TAB 2: MY REGISTRATIONS (Regular Users)                      */}
        {/* ============================================================ */}
        {activeTab === "my-registrations" && !isAdmin && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-[#34A853]" />
                  My Registrations
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Events you have registered to attend. Open your QR Pass or unregister anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("events")}
                className="btn-tactile inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl text-sm font-medium ring-1 ring-slate-700"
              >
                Browse All Events
              </button>
            </div>

            {regLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-slate-900/50 rounded-2xl ring-1 ring-slate-800 p-6 animate-pulse h-32"
                  />
                ))}
              </div>
            ) : regError ? (
              <div className="p-6 bg-[#EA4335]/10 ring-1 ring-[#EA4335]/30 rounded-2xl text-center">
                <AlertCircle className="w-10 h-10 text-[#EA4335] mx-auto mb-2" />
                <p className="text-rose-300 font-medium">{regError}</p>
                <button
                  type="button"
                  onClick={loadMyRegistrations}
                  className="btn-tactile mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-[#EA4335]/20 hover:bg-[#EA4335]/30 text-rose-200"
                >
                  Retry
                </button>
              </div>
            ) : myRegistrations.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 rounded-2xl ring-1 ring-slate-800">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 text-lg font-medium">
                  You haven't registered for any events yet
                </p>
                <p className="text-slate-500 text-sm mt-1 mb-5">
                  Explore available workshops, conferences, and hackathons to reserve your spot.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("events")}
                  className="btn-tactile px-5 py-2.5 bg-gradient-to-r from-[#4285F4] to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25"
                >
                  Explore Events
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myRegistrations.map((reg) => {
                  const ev = reg.event;
                  const evDate = new Date(ev.date);
                  const regDate = new Date(reg.registeredAt);
                  const isBusy = busyEventId === ev._id;
                  const theme = getCategoryTheme(ev.category);

                  return (
                    <div
                      key={reg._id}
                      className={`card-interactive bg-slate-900/75 rounded-2xl ring-1 ring-slate-800 ${theme.cardHover} overflow-hidden`}
                    >
                      <div className={`h-1 w-full ${theme.topBar}`} />
                      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${theme.badge}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                              {ev.category || "Workshop"}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#34A853]/15 text-emerald-300 ring-1 ring-[#34A853]/35 capitalize">
                              <CheckCircle2 className="w-3 h-3" />
                              {reg.status}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-white">{ev.title}</h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5 text-[#4285F4]" />
                              {evDate.toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}{" "}
                              at{" "}
                              {evDate.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>

                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#34A853]" />
                              {ev.venue || "Main Auditorium, Tech Hub"}
                            </span>

                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <Clock className="w-3.5 h-3.5" />
                              Registered{" "}
                              {regDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setQrTicketEvent({ event: ev, registeredAt: reg.registeredAt })
                            }
                            className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#34A853]/15 hover:bg-[#34A853]/25 text-emerald-300 ring-1 ring-[#34A853]/35"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            QR Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailsEvent(ev)}
                            className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 ring-1 ring-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#4285F4]" />
                            Details
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleLeave(ev._id)}
                            className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#EA4335]/15 hover:bg-[#EA4335]/25 disabled:opacity-50 text-rose-300 ring-1 ring-[#EA4335]/35"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            {isBusy ? "Cancelling…" : "Unregister"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: EVENT ANALYTICS (Admin Only Bonus Feature)            */}
        {/* ============================================================ */}
        {activeTab === "analytics" && isAdmin && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#FBBC05]" />
                  Event Registration Analytics
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Capacity utilization and attendee registration breakdown across all events.
                </p>
              </div>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-14 bg-slate-900/50 rounded-2xl ring-1 ring-slate-800">
                <p className="text-slate-400">No events to analyze yet.</p>
              </div>
            ) : (
              <div className="bg-slate-900/75 rounded-2xl ring-1 ring-slate-800 overflow-hidden shadow-xl">
                <div className="h-1 w-full gdg-gradient-bar" />
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/60">
                        <th className="py-3.5 px-4">Event</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Venue</th>
                        <th className="py-3.5 px-4">Registrations</th>
                        <th className="py-3.5 px-4">Utilization</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-sm">
                      {events.map((ev) => {
                        const count = ev.attendees.length;
                        const cap = ev.capacity || 50;
                        const pct = Math.min(100, Math.round((count / cap) * 100));
                        const theme = getCategoryTheme(ev.category);
                        return (
                          <tr key={ev._id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-white">{ev.title}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium ${theme.badge}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                                {ev.category || "Workshop"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 text-xs">{ev.venue}</td>
                            <td className="py-3.5 px-4 text-slate-300">
                              <strong className="text-white">{count}</strong> / {cap}
                            </td>
                            <td className="py-3.5 px-4 w-44">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      pct >= 100
                                        ? "bg-[#EA4335]"
                                        : pct >= 80
                                        ? "bg-[#FBBC05]"
                                        : "bg-[#34A853]"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-400 w-9 text-right">
                                  {pct}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setAttendeesEvent(ev)}
                                className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#34A853]/15 hover:bg-[#34A853]/25 text-emerald-300 ring-1 ring-[#34A853]/35"
                              >
                                <ClipboardList className="w-3.5 h-3.5" />
                                View Attendees
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editingEvent && (
        <CreateEventModal
          initialEvent={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleUpdate}
        />
      )}

      {/* Confirm Delete Modal */}
      {deletingEvent && (
        <ConfirmDeleteModal
          event={deletingEvent}
          onClose={() => setDeletingEvent(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Event Details Modal */}
      {detailsEvent && (
        <EventDetailsModal
          event={detailsEvent}
          busyEventId={busyEventId}
          onClose={() => setDetailsEvent(null)}
          onJoin={handleJoin}
          onLeave={handleLeave}
          onEdit={(ev) => setEditingEvent(ev)}
          onDelete={(ev) => setDeletingEvent(ev)}
          onViewAttendees={(ev) => setAttendeesEvent(ev)}
        />
      )}

      {/* Admin Attendees List Modal */}
      {attendeesEvent && (
        <AttendeesModal
          event={attendeesEvent}
          onClose={() => setAttendeesEvent(null)}
        />
      )}

      {/* QR Code Entry Pass Modal (Bonus: QR Codes + Calendar Reminders) */}
      {qrTicketEvent && (
        <QrTicketModal
          event={qrTicketEvent.event}
          user={user}
          registeredAt={qrTicketEvent.registeredAt}
          onClose={() => setQrTicketEvent(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 text-sm font-semibold rounded-xl shadow-2xl flex items-center gap-2 ${
            toast.type === "error"
              ? "bg-slate-900/95 text-rose-200 ring-1 ring-[#EA4335]/50"
              : "bg-slate-900/95 text-white ring-1 ring-[#34A853]/50"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-[#EA4335] shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#34A853] shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
