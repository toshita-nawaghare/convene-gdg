// ============================================================
// API Client Layer
// ============================================================

import type {
  AuthResponse,
  EventFormData,
  EventItem,
  EventRegistrationsResponse,
  User,
  UserRegistrationItem,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;

  constructor(message: string, status = 0, isNetworkError = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

export function isNetworkFailure(err: unknown): boolean {
  return err instanceof ApiError && err.isNetworkError;
}

// --- Token helper ---
// Prioritizes per-tab memory and sessionStorage, and validates that the JWT token's
// user ID matches the current tab's user so multiple tabs never mix up sessions.
const USER_TOKENS_KEY = "convene_user_tokens";

function getOrCreateTabId(): string {
  if (typeof window === "undefined") return "srv";
  const existing = sessionStorage.getItem("convene_tab_id");
  if (existing) return existing;
  const created = Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem("convene_tab_id", created);
  return created;
}

export const TAB_INSTANCE_ID = getOrCreateTabId();

export function getTokenUserId(token: string | null): string | null {
  if (!token) return null;
  if (token.startsWith("mock-token-")) {
    return token.replace("mock-token-", "");
  }
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.id === "string" ? payload.id : null;
  } catch {
    return null;
  }
}

function getSavedTokenForUser(userId: string): string | null {
  try {
    const raw = localStorage.getItem(USER_TOKENS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[userId] || null;
  } catch {
    return null;
  }
}

function saveTokenForUser(userId: string, token: string): void {
  try {
    const raw = localStorage.getItem(USER_TOKENS_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[userId] = token;
    localStorage.setItem(USER_TOKENS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

let tabUserId: string | null = null;
let tabToken: string | null =
  typeof window !== "undefined"
    ? sessionStorage.getItem("token") || localStorage.getItem("token")
    : null;

export function setTabUserId(userId: string | null): void {
  tabUserId = userId;
  if (userId) {
    // If current tabToken belongs to a different user, restore this user's token if available
    const currentTokenUserId = getTokenUserId(tabToken);
    if (currentTokenUserId && currentTokenUserId !== userId) {
      const matchingToken = getSavedTokenForUser(userId);
      if (matchingToken) {
        tabToken = matchingToken;
        sessionStorage.setItem("token", matchingToken);
      }
    }
  }
}

export function getToken(): string | null {
  if (tabUserId) {
    const currentOwner = getTokenUserId(tabToken);
    if (tabToken && currentOwner === tabUserId) {
      return tabToken;
    }
    const sessionTok = sessionStorage.getItem("token");
    if (sessionTok && getTokenUserId(sessionTok) === tabUserId) {
      tabToken = sessionTok;
      return sessionTok;
    }
    const savedForUser = getSavedTokenForUser(tabUserId);
    if (savedForUser) {
      tabToken = savedForUser;
      sessionStorage.setItem("token", savedForUser);
      return savedForUser;
    }
  }

  if (tabToken) return tabToken;
  const fromSession = sessionStorage.getItem("token");
  if (fromSession) {
    tabToken = fromSession;
    return fromSession;
  }
  const fromLocal = localStorage.getItem("token");
  if (fromLocal) {
    tabToken = fromLocal;
    sessionStorage.setItem("token", fromLocal);
    return fromLocal;
  }
  return null;
}

export function setToken(token: string, userId?: string): void {
  const resolvedUserId = userId || getTokenUserId(token);
  if (resolvedUserId) {
    tabUserId = resolvedUserId;
    saveTokenForUser(resolvedUserId, token);
  }
  tabToken = token;
  sessionStorage.setItem("token", token);
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  tabToken = null;
  tabUserId = null;
  sessionStorage.removeItem("token");
  localStorage.removeItem("token");
}

// Optional callback when a 401 token expiration is detected on protected endpoints
let onUnauthorizedCallback: (() => void) | null = null;
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorizedCallback = cb;
}

// --- Internal fetch wrapper ---
async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Backend server is unreachable", 0, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.message || `Request failed (${res.status})`;

    // Trigger session expiry handler if a protected endpoint returns 401
    const isAuthEndpoint =
      path.includes("/auth/login") ||
      path.includes("/auth/signup") ||
      path.includes("/auth/register");
    if (res.status === 401 && !isAuthEndpoint && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }

    throw new ApiError(msg, res.status, false);
  }

  return res.json();
}

// ============================================================
// REAL API CALLS (hit the Express backend → MongoDB)
// ============================================================

export const api = {
  // --- Auth ---
  signup: (name: string, email: string, password: string, role: "user" | "admin") =>
    apiFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    }) as Promise<AuthResponse>,

  login: (email: string, password: string) =>
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }) as Promise<AuthResponse>,

  getMe: async (tabUserId?: string): Promise<{ user: User; token?: string }> => {
    try {
      const qs = tabUserId ? `?tabUserId=${encodeURIComponent(tabUserId)}` : "";
      return (await apiFetch(`/api/auth/me${qs}`)) as {
        user: User;
        token?: string;
      };
    } catch (err) {
      // Fallback if backend process hasn't been restarted yet and /api/auth/me returns 404
      if (err instanceof ApiError && err.status === 404) {
        await apiFetch("/api/events");
        const stored = sessionStorage.getItem("user") || localStorage.getItem("user");
        if (stored) {
          return { user: JSON.parse(stored) as User };
        }
      }
      throw err;
    }
  },

  // --- Events ---
  getEvents: (params?: { search?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.category && params.category !== "All") query.set("category", params.category);
    const qs = query.toString();
    return apiFetch(`/api/events${qs ? `?${qs}` : ""}`) as Promise<EventItem[]>;
  },

  getEventById: (id: string) =>
    apiFetch(`/api/events/${id}`) as Promise<EventItem>,

  createEvent: (data: EventFormData) =>
    apiFetch("/api/events", {
      method: "POST",
      body: JSON.stringify(data),
    }) as Promise<EventItem>,

  updateEvent: (id: string, data: Partial<EventFormData>) =>
    apiFetch(`/api/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }) as Promise<EventItem>,

  deleteEvent: (id: string) =>
    apiFetch(`/api/events/${id}`, { method: "DELETE" }) as Promise<{ message: string }>,

  // --- Registrations ---
  joinEvent: async (id: string) => {
    try {
      return await apiFetch(`/api/events/${id}/registrations`, { method: "POST" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return await apiFetch(`/api/events/${id}/join`, { method: "POST" });
      }
      throw err;
    }
  },

  leaveEvent: async (id: string) => {
    try {
      return await apiFetch(`/api/events/${id}/registrations/me`, { method: "DELETE" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return await apiFetch(`/api/events/${id}/leave`, { method: "POST" });
      }
      throw err;
    }
  },

  getMyRegistrations: async (): Promise<UserRegistrationItem[]> => {
    try {
      return (await apiFetch("/api/registrations/me")) as UserRegistrationItem[];
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        const events = (await apiFetch("/api/events")) as EventItem[];
        const stored = localStorage.getItem("user");
        const user: User | null = stored ? JSON.parse(stored) : null;
        if (!user) return [];
        return events
          .filter((ev) => ev.attendees.some((a) => a._id === user.id))
          .map((ev) => ({
            _id: `reg-${ev._id}-${user.id}`,
            status: "confirmed" as const,
            registeredAt: new Date().toISOString(),
            event: ev,
          }));
      }
      throw err;
    }
  },

  getEventRegistrations: async (id: string): Promise<EventRegistrationsResponse> => {
    try {
      return (await apiFetch(`/api/events/${id}/registrations`)) as EventRegistrationsResponse;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        const events = (await apiFetch("/api/events")) as EventItem[];
        const ev = events.find((e) => e._id === id);
        if (!ev) throw new ApiError("Event not found", 404);
        return {
          event: {
            _id: ev._id,
            title: ev.title,
            date: ev.date,
            venue: ev.venue || "Main Auditorium, Tech Hub",
            capacity: ev.capacity || 50,
            category: ev.category || "Workshop",
            registrationCount: ev.attendees.length,
          },
          registrations: ev.attendees.map((a) => ({
            _id: `reg-${ev._id}-${a._id}`,
            attendeeName: a.name,
            attendeeEmail: a.email,
            registeredAt: new Date().toISOString(),
            status: "confirmed" as const,
            user: { _id: a._id, name: a.name, email: a.email },
          })),
        };
      }
      throw err;
    }
  },
};

// ============================================================
// MOCK FALLBACK (Used only when backend server is unreachable)
// ============================================================

interface MockUser extends User {
  password: string;
}

interface MockAttendance {
  user: MockUser;
  registeredAt: string;
}

interface MockEvent extends Omit<EventItem, "createdBy" | "attendees"> {
  createdBy: MockUser;
  attendees: MockAttendance[];
}

const mockUsers: MockUser[] = [
  { id: "u1", name: "Alice User", email: "alice@test.com", password: "password", role: "user" },
  { id: "u2", name: "Siddhi Sharma", email: "admin@test.com", password: "password", role: "admin" },
];

let mockEvents: MockEvent[] = [
  {
    _id: "e1",
    title: "React Workshop",
    description:
      "Hands-on session covering modern React hooks, context architecture, performance optimization, and state management patterns.",
    date: "2026-11-15T18:00:00.000Z",
    venue: "MBA Auditorium",
    capacity: 30,
    category: "Workshop",
    createdBy: mockUsers[1],
    attendees: [{ user: mockUsers[0], registeredAt: "2026-10-01T10:00:00.000Z" }],
  },
  {
    _id: "e2",
    title: "Node.js Deep Dive",
    description:
      "Explore Express middleware design, JWT security, rate limiting, and atomic MongoDB operations end-to-end.",
    date: "2026-12-03T17:00:00.000Z",
    venue: "DT-701",
    capacity: 50,
    category: "Conference",
    createdBy: mockUsers[1],
    attendees: [],
  },
  {
    _id: "e3",
    title: "Open Source Hackathon",
    description:
      "A weekend of building, collaborating, and contributing to open-source developer tools with mentorship from industry engineers.",
    date: "2026-12-20T09:00:00.000Z",
    venue: "DT-906",
    capacity: 100,
    category: "Hackathon",
    createdBy: mockUsers[1],
    attendees: [{ user: mockUsers[0], registeredAt: "2026-10-02T14:30:00.000Z" }],
  },
];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripUser(u: MockUser): User {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function stripEvent(e: MockEvent): EventItem {
  return {
    _id: e._id,
    title: e.title,
    description: e.description,
    date: e.date,
    venue: e.venue,
    capacity: e.capacity,
    category: e.category,
    createdBy: { _id: e.createdBy.id, name: e.createdBy.name, email: e.createdBy.email },
    attendees: e.attendees.map((a) => ({
      _id: a.user.id,
      name: a.user.name,
      email: a.user.email,
    })),
    registrationCount: e.attendees.length,
    spotsRemaining: Math.max(0, e.capacity - e.attendees.length),
    isFull: e.attendees.length >= e.capacity,
  };
}

export const mockApi: typeof api = {
  async signup(
    name: string,
    email: string,
    password: string,
    role: "user" | "admin"
  ): Promise<AuthResponse> {
    await delay(250);
    const normalizedEmail = email.trim().toLowerCase();
    const existing = mockUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) throw new ApiError("Email already registered", 409);
    const newUser: MockUser = {
      id: `u${mockUsers.length + 1}`,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    };
    mockUsers.push(newUser);
    return { token: `mock-token-${newUser.id}`, user: stripUser(newUser) };
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    await delay(250);
    const normalizedEmail = email.trim().toLowerCase();
    const user = mockUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user || user.password !== password) {
      throw new ApiError("Invalid email or password", 401);
    }
    return { token: `mock-token-${user.id}`, user: stripUser(user) };
  },

  async getMe(): Promise<{ user: User }> {
    await delay(100);
    const current = getCurrentMockUser();
    if (!current) throw new ApiError("Invalid or expired token", 401);
    return { user: stripUser(current) };
  },

  async getEvents(params?: { search?: string; category?: string }): Promise<EventItem[]> {
    await delay(150);
    let list = mockEvents.map(stripEvent);
    if (params?.category && params.category !== "All") {
      list = list.filter((e) => e.category === params.category);
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async getEventById(id: string): Promise<EventItem> {
    await delay(100);
    const ev = mockEvents.find((e) => e._id === id);
    if (!ev) throw new ApiError("Event not found", 404);
    return stripEvent(ev);
  },

  async createEvent(data: EventFormData): Promise<EventItem> {
    await delay(250);
    const currentUser = getCurrentMockUser();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ApiError("You are not authorized to perform this action.", 403);
    }
    const newEvent: MockEvent = {
      _id: `e${Date.now()}`,
      title: data.title.trim(),
      description: data.description.trim(),
      date: new Date(data.date).toISOString(),
      venue: data.venue.trim(),
      capacity: Number(data.capacity),
      category: data.category,
      createdBy: currentUser,
      attendees: [],
    };
    mockEvents.unshift(newEvent);
    return stripEvent(newEvent);
  },

  async updateEvent(id: string, data: Partial<EventFormData>): Promise<EventItem> {
    await delay(250);
    const currentUser = getCurrentMockUser();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ApiError("You are not authorized to perform this action.", 403);
    }
    const event = mockEvents.find((e) => e._id === id);
    if (!event) throw new ApiError("Event not found", 404);

    if (data.capacity !== undefined && Number(data.capacity) < event.attendees.length) {
      throw new ApiError(
        `Capacity (${data.capacity}) cannot be less than current registered attendees (${event.attendees.length}).`,
        400
      );
    }

    if (data.title !== undefined) event.title = data.title.trim();
    if (data.description !== undefined) event.description = data.description.trim();
    if (data.date !== undefined) event.date = new Date(data.date).toISOString();
    if (data.venue !== undefined) event.venue = data.venue.trim();
    if (data.capacity !== undefined) event.capacity = Number(data.capacity);
    if (data.category !== undefined) event.category = data.category;

    return stripEvent(event);
  },

  async deleteEvent(id: string): Promise<{ message: string }> {
    await delay(200);
    const currentUser = getCurrentMockUser();
    if (!currentUser || currentUser.role !== "admin") {
      throw new ApiError("You are not authorized to perform this action.", 403);
    }
    mockEvents = mockEvents.filter((e) => e._id !== id);
    return { message: "Event deleted" };
  },

  async joinEvent(id: string): Promise<{ message: string }> {
    await delay(200);
    const event = mockEvents.find((e) => e._id === id);
    const user = getCurrentMockUser();
    if (!event) throw new ApiError("Event not found", 404);
    if (!user) throw new ApiError("Authentication required. Please log in.", 401);

    if (event.attendees.some((a) => a.user.id === user.id)) {
      throw new ApiError("You are already registered for this event.", 409);
    }
    if (event.attendees.length >= event.capacity) {
      throw new ApiError("This event is full.", 409);
    }

    event.attendees.push({ user, registeredAt: new Date().toISOString() });
    return { message: "Successfully registered for the event." };
  },

  async leaveEvent(id: string): Promise<{ message: string }> {
    await delay(200);
    const event = mockEvents.find((e) => e._id === id);
    const user = getCurrentMockUser();
    if (!event) throw new ApiError("Event not found", 404);
    if (!user) throw new ApiError("Authentication required. Please log in.", 401);

    event.attendees = event.attendees.filter((a) => a.user.id !== user.id);
    return { message: "Successfully unregistered from the event." };
  },

  async getMyRegistrations(): Promise<UserRegistrationItem[]> {
    await delay(150);
    const user = getCurrentMockUser();
    if (!user) throw new ApiError("Authentication required. Please log in.", 401);

    const items: UserRegistrationItem[] = [];
    for (const ev of mockEvents) {
      const found = ev.attendees.find((a) => a.user.id === user.id);
      if (found) {
        items.push({
          _id: `reg-${ev._id}-${user.id}`,
          status: "confirmed",
          registeredAt: found.registeredAt,
          event: stripEvent(ev),
        });
      }
    }
    return items;
  },

  async getEventRegistrations(id: string): Promise<EventRegistrationsResponse> {
    await delay(150);
    const user = getCurrentMockUser();
    if (!user || user.role !== "admin") {
      throw new ApiError("You are not authorized to perform this action.", 403);
    }
    const ev = mockEvents.find((e) => e._id === id);
    if (!ev) throw new ApiError("Event not found", 404);

    return {
      event: {
        _id: ev._id,
        title: ev.title,
        date: ev.date,
        venue: ev.venue,
        capacity: ev.capacity,
        category: ev.category,
        registrationCount: ev.attendees.length,
      },
      registrations: ev.attendees.map((a, idx) => ({
        _id: `reg-${ev._id}-${idx}`,
        attendeeName: a.user.name,
        attendeeEmail: a.user.email,
        registeredAt: a.registeredAt,
        status: "confirmed",
        user: { _id: a.user.id, name: a.user.name, email: a.user.email },
      })),
    };
  },
};

// Helper for mock mode — reads the current mock user from memory or localStorage
let _currentMockUserId: string | null = null;
export function setCurrentMockUser(user: User) {
  _currentMockUserId = user.id;
  const exists = mockUsers.some((u) => u.id === user.id);
  if (!exists) {
    mockUsers.push({ ...user, password: "password" });
  }
}

function getCurrentMockUser(): MockUser | null {
  if (_currentMockUserId) {
    const found = mockUsers.find((u) => u.id === _currentMockUserId);
    if (found) return found;
  }
  const stored = localStorage.getItem("user");
  if (stored) {
    try {
      const parsed: User = JSON.parse(stored);
      return { ...parsed, password: "password" };
    } catch {
      return null;
    }
  }
  return null;
}
