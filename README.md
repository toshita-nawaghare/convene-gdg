# Convene — Event Management & Registration System

A complete, role-based **Event Management & Registration** platform built with **MongoDB, Express, React (TypeScript + Vite), and Node.js**.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Complete Feature List](#complete-feature-list)
3. [Tech Stack](#tech-stack)
4. [Folder Structure](#folder-structure)
5. [Prerequisites](#prerequisites)
6. [Local Setup Instructions](#local-setup-instructions)
7. [Environment Variables](#environment-variables)
8. [Database Seeding & Migrations](#database-seeding--migrations)
9. [Running, Building & Testing](#running-building--testing)
10. [Default Seed Credentials](#default-seed-credentials)
11. [API Endpoint Summary](#api-endpoint-summary)
12. [Root-Cause Analysis: "New Users See No Events" Bug](#root-cause-analysis-new-users-see-no-events-bug)
13. [Deployment Notes & Known Limitations](#deployment-notes--known-limitations)

---

## Project Overview

This application enables organizations to publish and manage events while allowing attendees to discover events, inspect event details and live capacity, register or unregister with concurrency-safe capacity enforcement, and manage their personal event schedule.

---

## Complete Feature List

- **Authentication & Role-Based Access Control (RBAC)**
  - JWT-based signup (`/api/auth/register` & `/api/auth/signup`), login (`/api/auth/login`), logout, and session verification (`/api/auth/me`).
  - Passwords hashed with `bcryptjs` (10 salt rounds); password hashes are stripped from all API responses and Mongoose `toJSON` transforms.
  - Persistent session across browser refreshes via `localStorage` + token verification on startup.
  - Automatic detection of expired/invalid JWTs (`401`) with clean redirection to the login screen and a session-expired notice.
  - Sliding-window rate limiting on authentication endpoints (`429 Too Many Requests` when exceeded).
- **Event CRUD (Admin)**
  - Full event schema with `title`, `description`, `date` (date/time), `venue`, `capacity`, and `category` (`Workshop`, `Conference`, `Hackathon`, `Meetup`, `Webinar`, `Networking`, `Other`).
  - Create Event modal with client-side and backend validation.
  - Edit Event modal prefilled with existing event details; prevents reducing capacity below the current number of registered attendees; updates the UI immediately without requiring a page reload.
  - Delete Event confirmation modal (`ConfirmDeleteModal`) with cascading cleanup of associated `Registration` documents.
- **Event Discovery & Filtering (All Users)**
  - Instant search across event `title`, `venue`, `category`, and `description`.
  - Category filter pills (`All`, `Workshop`, `Conference`, `Hackathon`, `Meetup`, `Webinar`, `Networking`, `Other`).
  - Event Details modal showing full description, date/time, venue, organizer, live capacity bar, and role-appropriate actions.
- **Concurrency-Safe Registrations & Data Consistency**
  - Dedicated `Registration` Mongoose model with a database-level unique compound index on `{ user: 1, event: 1 }` to prevent duplicate registrations.
  - Atomic conditional MongoDB update (`Event.findOneAndUpdate` with `attendees: { $ne: userId }` and `$expr: { $lt: [{ $size: "$attendees" }, "$capacity"] }`) to prevent race conditions when an event is near full capacity.
  - Clear error responses (`409 Conflict`): `"You are already registered for this event."` and `"This event is full."`.
- **My Registrations (Attendee) & Attendee List / Analytics (Admin)**
  - **My Registrations** tab for regular users (`GET /api/registrations/me`) showing only the logged-in user's registered events, registration date/time, status badge (`confirmed`), and one-click `Unregister`.
  - **Admin Attendee List** modal per event (`GET /api/events/:id/registrations`) displaying attendee name, email, registration timestamp, and registration status.
  - **Admin Event Analytics** tab showing capacity utilization percentages and registration counts across all events.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS 3, Lucide React Icons
- **Backend:** Node.js (ES Modules), Express 4, CORS, Dotenv
- **Database / ODM:** MongoDB, Mongoose 8
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Built-in Sliding-Window Auth Rate Limiter

---

## Folder Structure

```text
GDG-event-management-project/
├── backend/
│   ├── server.js                  # Express API server, Mongoose models, auth/RBAC, atomic registration routes
│   ├── seed.js                    # Standalone idempotent database seed & backfill script
│   ├── package.json               # Backend dependencies & scripts (start, dev, seed)
│   └── .env.example               # Backend environment variable template (no real secrets)
├── src/
│   ├── App.tsx                    # Root component with AuthProvider and protected routing
│   ├── AuthContext.tsx            # Global auth state, session verification, and navigation tab state
│   ├── api.ts                     # Fetch API client + offline mock fallback + 401 handler
│   ├── types.ts                   # Shared TypeScript interfaces (User, EventItem, Registration types)
│   ├── main.tsx                   # React DOM entry point
│   ├── index.css                  # Tailwind CSS imports
│   └── components/
│       ├── AuthPage.tsx           # Sign In / Sign Up screen ("Enter your name" placeholder)
│       ├── Header.tsx             # Navigation bar with role badge, tabs, and Sign Out
│       ├── EventDashboard.tsx     # Main dashboard: Browse/Filter Events, My Registrations, Admin Analytics
│       ├── EventCard.tsx          # Event card with capacity progress bar and role-based actions
│       ├── CreateEventModal.tsx   # Create & Edit Event modal with client-side validation
│       ├── EventDetailsModal.tsx  # Detailed event modal with full info and actions
│       ├── AttendeesModal.tsx     # Admin-only modal displaying attendee registrations per event
│       └── ConfirmDeleteModal.tsx # Confirmation dialog for deleting an event
├── .env.example                   # Frontend environment variable template
├── .gitignore                     # Git ignore rules for node_modules, .env, build artifacts
├── package.json                   # Frontend dependencies & scripts (dev, build, lint, typecheck)
└── README.md                      # Project documentation
```

---

## Prerequisites

- **Node.js** `v18+` (recommended `v20+`) and `npm`
- **MongoDB** (Local MongoDB Community Server running on `mongodb://127.0.0.1:27017` or a MongoDB Atlas connection URI)

---

## Local Setup Instructions

### 1. Clone the repository & install dependencies

```bash
# Install frontend dependencies (from project root)
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Configure Environment Variables

Copy the example environment files and fill in your local values:

```bash
# Frontend environment (optional if backend runs on http://localhost:5000)
cp .env.example .env

# Backend environment
cp backend/.env.example backend/.env
```

---

## Environment Variables

### `backend/.env` (see `backend/.env.example`)

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/event_manager
JWT_SECRET=replace_with_a_strong_random_jwt_secret
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=50
```

### Root `.env` (see `.env.example`)

```env
VITE_API_URL=http://localhost:5000
```

> **Security Note:** Never commit `.env` or `backend/.env` to version control. Both are excluded in `.gitignore`.

---

## Database Seeding & Migrations

The backend automatically performs a **safe, non-destructive seed and schema backfill** on startup:
- Creates the default demo accounts (`admin@test.com` and `alice@test.com`) if they do not exist.
- Seeds 3 sample events (`React Workshop`, `Node.js Deep Dive`, `Open Source Hackathon`) if the `events` collection is empty.
- Backfills `venue`, `capacity`, `category`, and `Registration` documents for any legacy events without modifying or deleting existing data.
- Builds the unique compound index `{ user: 1, event: 1 }` on the `Registration` collection.

You can also run the standalone seed script at any time:

```bash
cd backend
npm run seed
```

---

## Running, Building & Testing

### Start the Backend Server (Terminal 1)

```bash
cd backend
npm start
# Or with auto-reload during development:
npm run dev
```

The backend API listens on `http://localhost:5000`.

### Start the Frontend Dev Server (Terminal 2)

```bash
# From the project root
npm run dev
```

The React app runs at `http://localhost:5173`.

### Production Build & Typecheck

```bash
npm run typecheck
npm run build
```

---

## Default Seed Credentials

These safe local demo accounts are seeded automatically into MongoDB on startup:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@test.com` | `password` |
| **Normal User (Attendee)** | `alice@test.com` | `password` |

---

## API Endpoint Summary

All routes are mounted at both `/api/...` and `/...` for full compatibility:

| Method | Endpoint | Auth | Role | Status Codes | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` (or `/api/auth/signup`) | Public | — | `201`, `400`, `409`, `429` | Register a new user or admin account |
| `POST` | `/api/auth/login` | Public | — | `200`, `400`, `401`, `429` | Authenticate user and receive JWT |
| `POST` | `/api/auth/logout` | Public | — | `200` | Acknowledge client logout |
| `GET` | `/api/auth/me` | Bearer JWT | Any | `200`, `401` | Verify token and return current user profile |
| `GET` | `/api/events` | Public | Any | `200` | List all events (supports `?search=` & `?category=`) |
| `GET` | `/api/events/:id` | Public | Any | `200`, `404` | Get details for a single event |
| `POST` | `/api/events` | Bearer JWT | `admin` | `201`, `400`, `401`, `403` | Create a new event |
| `PUT` / `PATCH` | `/api/events/:id` | Bearer JWT | `admin` | `200`, `400`, `401`, `403`, `404` | Update an existing event |
| `DELETE` | `/api/events/:id` | Bearer JWT | `admin` | `200`, `401`, `403`, `404` | Delete an event and its registrations |
| `POST` | `/api/events/:id/registrations` (or `/join`) | Bearer JWT | Any | `201`, `401`, `404`, `409` | Register authenticated user for an event |
| `DELETE` | `/api/events/:id/registrations/me` (or `POST /leave`) | Bearer JWT | Any | `200`, `400`, `401`, `404` | Cancel/unregister current user's registration |
| `GET` | `/api/registrations/me` | Bearer JWT | Any | `200`, `401` | List current user's registered events |
| `GET` | `/api/events/:id/registrations` | Bearer JWT | `admin` | `200`, `401`, `403`, `404` | List all attendees & registration timestamps for an event |

---

## Root-Cause Analysis: "New Users See No Events" Bug

1. **Unseeded MongoDB vs. In-Memory Mock Fallback:**
   - The backend server (`http://localhost:5000`) connected to an empty MongoDB database (`GET /api/events` returned `[]`) because there was no startup seeding for the default accounts (`alice@test.com`, `admin@test.com`) or sample events.
   - In `src/AuthContext.tsx`, `login()` previously wrapped `await api.login(email, password)` in a catch-all `try / catch` that fell back to `mockApi.login()` on **any** error (including HTTP `400 Invalid email or password` from the live backend). Logging in with `alice@test.com` failed on the unseeded live backend, silently switched `backendMode` to `"mock"`, and displayed the 3 hardcoded `mockEvents` from `src/api.ts`.
2. **Why Newly Signed-Up Users Saw No Events:**
   - Signing up as a new user called `POST /api/auth/signup` on the live backend, which succeeded (`201 Created`) and set `backendMode` to `"live"`.
   - `EventDashboard` then queried `GET /api/events` from the live MongoDB database, which was empty (`[]`).
3. **Fix Applied:**
   - Added idempotent startup seeding (`seedDatabaseIfNeeded`) in `backend/server.js` (and `backend/seed.js`) so the live MongoDB database is populated with the default demo users and events when empty.
   - Updated `src/api.ts` and `src/AuthContext.tsx` to distinguish network connection failures (`isNetworkFailure`) from HTTP `4xx`/`5xx` API errors so live backend authentication errors are surfaced accurately and all users operate consistently against the live API.

---

## Deployment Notes & Known Limitations

- **Deployment:**
  - Deploy `backend/` to a Node.js host (Render, Railway, Fly.io) with `MONGO_URI`, `JWT_SECRET`, and `PORT` configured.
  - Deploy the root Vite frontend to Vercel or Netlify with `VITE_API_URL` pointing to the deployed backend URL, and build command `npm run build` (output directory `dist`).
- **Known Limitations:**
  - The authentication rate limiter uses an in-memory `Map` per server process; for multi-instance horizontal scaling behind a load balancer, a shared Redis store is recommended.
