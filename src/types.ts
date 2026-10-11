// Shared TypeScript types and GDG 4-color category theme helpers used across the frontend.

export type Role = "user" | "admin";

export type EventCategory =
  | "Workshop"
  | "Conference"
  | "Hackathon"
  | "Meetup"
  | "Webinar"
  | "Networking"
  | "Other";

export const EVENT_CATEGORIES: EventCategory[] = [
  "Workshop",
  "Conference",
  "Hackathon",
  "Meetup",
  "Webinar",
  "Networking",
  "Other",
];

export interface CategoryTheme {
  badge: string;
  dot: string;
  topBar: string;
  cardHover: string;
  dateAccent: string;
  activePill: string;
}

// Maps each category to one of the 4 GDG colors (Blue, Red, Yellow, Green)
export function getCategoryTheme(category?: string): CategoryTheme {
  switch (category) {
    case "Conference":
      // GDG Red (#EA4335)
      return {
        badge: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/35",
        dot: "bg-[#EA4335]",
        topBar: "bg-gradient-to-r from-[#EA4335] to-rose-400",
        cardHover: "hover:ring-rose-500/50 hover:shadow-2xl hover:shadow-rose-500/10",
        dateAccent: "text-rose-400",
        activePill:
          "bg-[#EA4335] text-white shadow-md shadow-rose-500/30 ring-1 ring-rose-400/50",
      };
    case "Hackathon":
    case "Networking":
      // GDG Yellow (#FBBC05)
      return {
        badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35",
        dot: "bg-[#FBBC05]",
        topBar: "bg-gradient-to-r from-[#FBBC05] to-amber-400",
        cardHover: "hover:ring-amber-500/50 hover:shadow-2xl hover:shadow-amber-500/10",
        dateAccent: "text-amber-400",
        activePill:
          "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/30 ring-1 ring-amber-300/60",
      };
    case "Meetup":
    case "Other":
      // GDG Green (#34A853)
      return {
        badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35",
        dot: "bg-[#34A853]",
        topBar: "bg-gradient-to-r from-[#34A853] to-emerald-400",
        cardHover: "hover:ring-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10",
        dateAccent: "text-emerald-400",
        activePill:
          "bg-[#34A853] text-white shadow-md shadow-emerald-500/30 ring-1 ring-emerald-400/50",
      };
    case "Workshop":
    case "Webinar":
    default:
      // GDG Blue (#4285F4)
      return {
        badge: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/35",
        dot: "bg-[#4285F4]",
        topBar: "bg-gradient-to-r from-[#4285F4] to-sky-400",
        cardHover: "hover:ring-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10",
        dateAccent: "text-blue-400",
        activePill:
          "bg-[#4285F4] text-white shadow-md shadow-blue-500/30 ring-1 ring-blue-400/50",
      };
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EventItem {
  _id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  capacity: number;
  category: string;
  createdBy: { _id: string; name: string; email: string };
  attendees: { _id: string; name: string; email: string }[];
  registrationCount?: number;
  spotsRemaining?: number;
  isFull?: boolean;
}

export interface EventFormData {
  title: string;
  description: string;
  date: string;
  venue: string;
  capacity: number;
  category: string;
}

export interface UserRegistrationItem {
  _id: string;
  status: "confirmed" | "cancelled";
  registeredAt: string;
  event: EventItem;
}

export interface AttendeeRegistrationItem {
  _id: string;
  attendeeName: string;
  attendeeEmail: string;
  registeredAt: string;
  status: "confirmed" | "cancelled";
  user: { _id: string; name: string; email: string };
}

export interface EventRegistrationsResponse {
  event: {
    _id: string;
    title: string;
    date: string;
    venue: string;
    capacity: number;
    category: string;
    registrationCount: number;
  };
  registrations: AttendeeRegistrationItem[];
}
