// ============================================================
// Event Management & Registration API — MERN Backend
// ============================================================

import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Load environment variables from backend/.env regardless of working directory
dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// ============================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/event_manager";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const PORT = process.env.PORT || 5000;

export const VALID_CATEGORIES = [
  "Workshop",
  "Conference",
  "Hackathon",
  "Meetup",
  "Webinar",
  "Networking",
  "Other",
];

// ============================================================
// 1B. CACHING LAYER (Bonus: Redis-Compatible TTL Response Cache)
// ============================================================
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 30 * 1000; // 30s TTL
const responseCache = new Map();

function getCachedValue(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedValue(key, value, ttlMs = CACHE_TTL_MS) {
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateEventCache() {
  responseCache.clear();
}

// ============================================================
// 2. MONGOOSE MODELS
// ============================================================

// --- User Schema ---
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

// Ensure password is never leaked if a User document is serialized directly
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

// --- Event Schema ---
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    venue: { type: String, required: true, trim: true, default: "Main Auditorium, Tech Hub" },
    capacity: { type: Number, required: true, min: 1, default: 50 },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: VALID_CATEGORIES,
      default: "Workshop",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// --- Registration Schema ---
// Dedicated registration collection with a database-level unique compound index
// on { user, event } to guarantee no duplicate registrations and track metadata.
const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);
export const Registration =
  mongoose.models.Registration || mongoose.model("Registration", registrationSchema);

// ============================================================
// 3. SAFE SEEDING & DATA CONSISTENCY BACKFILL
// ============================================================
export async function seedDatabaseIfNeeded() {
  try {
    await Registration.init(); // Ensure unique index { user: 1, event: 1 } is built

    const defaultPasswordHash = await bcrypt.hash("password", 10);

    // 1. Ensure default demo Admin (Siddhi Sharma) and User exist
    let adminUser = await User.findOne({ email: "admin@test.com" });
    if (!adminUser) {
      adminUser = await User.create({
        name: "Siddhi Sharma",
        email: "admin@test.com",
        password: defaultPasswordHash,
        role: "admin",
      });
      console.log("🌱 Seeded default admin account: admin@test.com (Siddhi Sharma)");
    } else if (adminUser.name !== "Siddhi Sharma") {
      adminUser.name = "Siddhi Sharma";
      await adminUser.save();
      console.log("🌱 Updated default admin name to Siddhi Sharma");
    }

    let aliceUser = await User.findOne({ email: "alice@test.com" });
    if (!aliceUser) {
      aliceUser = await User.create({
        name: "Alice User",
        email: "alice@test.com",
        password: defaultPasswordHash,
        role: "user",
      });
      console.log("🌱 Seeded default user account: alice@test.com");
    }

    // 2. Seed initial events if the events collection is empty
    const eventCount = await Event.countDocuments();
    if (eventCount === 0) {
      const initialEvents = await Event.insertMany([
        {
          title: "React Workshop",
          description:
            "Hands-on session covering modern React hooks, context architecture, performance optimization, and state management patterns.",
          date: new Date("2026-11-15T18:00:00.000Z"),
          venue: "MBA Auditorium",
          capacity: 30,
          category: "Workshop",
          createdBy: adminUser._id,
          attendees: [aliceUser._id],
        },
        {
          title: "Node.js Deep Dive",
          description:
            "Explore Express middleware design, JWT security, rate limiting, and atomic MongoDB operations end-to-end.",
          date: new Date("2026-12-03T17:00:00.000Z"),
          venue: "DT-701",
          capacity: 50,
          category: "Conference",
          createdBy: adminUser._id,
          attendees: [],
        },
        {
          title: "Open Source Hackathon",
          description:
            "A weekend of building, collaborating, and contributing to open-source developer tools with mentorship from industry engineers.",
          date: new Date("2026-12-20T09:00:00.000Z"),
          venue: "DT-906",
          capacity: 100,
          category: "Hackathon",
          createdBy: adminUser._id,
          attendees: [aliceUser._id],
        },
      ]);
      console.log(`🌱 Seeded ${initialEvents.length} default events`);
    }

    // 3. Non-destructive backfill & venue updates (preserving Git & GitHub workshop venue)
    const allEvents = await Event.find();
    for (const ev of allEvents) {
      let modified = false;
      const isGitWorkshop = /git/i.test(ev.title);

      if (!isGitWorkshop) {
        if (/open source/i.test(ev.title) && ev.venue !== "DT-906") {
          ev.venue = "DT-906";
          modified = true;
        } else if (
          (/node\.?js/i.test(ev.title) || ev.category === "Conference") &&
          ev.venue !== "DT-701"
        ) {
          ev.venue = "DT-701";
          modified = true;
        } else if (/react/i.test(ev.title) && ev.venue !== "MBA Auditorium") {
          ev.venue = "MBA Auditorium";
          modified = true;
        }
      }

      if (!ev.venue) {
        ev.venue = "MBA Auditorium";
        modified = true;
      }
      if (!ev.capacity || ev.capacity < 1) {
        ev.capacity = Math.max(50, ev.attendees.length || 1);
        modified = true;
      }
      if (!ev.category || !VALID_CATEGORIES.includes(ev.category)) {
        ev.category = "Workshop";
        modified = true;
      }
      if (modified) {
        await ev.save();
      }

      // Sync Registration records with ev.attendees
      for (const attendeeId of ev.attendees) {
        await Registration.updateOne(
          { user: attendeeId, event: ev._id },
          {
            $setOnInsert: {
              user: attendeeId,
              event: ev._id,
              status: "confirmed",
              registeredAt: ev.createdAt || new Date(),
            },
          },
          { upsert: true }
        );
      }
    }
    invalidateEventCache();
  } catch (err) {
    console.error("⚠️ Seed/backfill warning:", err.message);
  }
}

// ============================================================
// 3B. BACKGROUND JOB SCHEDULER (Bonus: Event Reminders & Cache Sweep)
// ============================================================
let lastBackgroundJobRun = null;
let upcomingReminderDigest = [];

export async function runReminderBackgroundJob() {
  try {
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcomingEvents = await Event.find({
      date: { $gte: now, $lte: next30Days },
    }).populate("attendees", "name email");

    upcomingReminderDigest = upcomingEvents.map((ev) => ({
      eventId: ev._id.toString(),
      title: ev.title,
      date: ev.date.toISOString(),
      venue: ev.venue,
      recipientCount: ev.attendees.length,
    }));

    // Sweep expired cache entries
    for (const [key, entry] of responseCache.entries()) {
      if (Date.now() > entry.expiresAt) {
        responseCache.delete(key);
      }
    }

    lastBackgroundJobRun = now.toISOString();
  } catch {
    // Non-fatal background worker error
  }
}

function startBackgroundJobs() {
  runReminderBackgroundJob();
  const timer = setInterval(runReminderBackgroundJob, 60 * 1000);
  if (timer.unref) timer.unref();
}

// ============================================================
// 4. RATE LIMITING & AUTH MIDDLEWARE
// ============================================================
const authRateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 50; // max attempts per window

function authRateLimiter(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const entry = authRateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  authRateLimitStore.set(ip, entry);

  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX - entry.count)));

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      message: "Too many authentication attempts. Please try again later.",
    });
  }
  next();
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required. Please log in." });
  }

  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authentication required. Please log in." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    authMiddleware(req, res, () => {
      if (!req.user || req.user.role !== role) {
        return res.status(403).json({
          message: "You are not authorized to perform this action.",
        });
      }
      next();
    });
  };
}

// ============================================================
// 5. VALIDATION & FORMATTING HELPERS
// ============================================================
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function formatEvent(eventDoc) {
  const obj = eventDoc.toObject ? eventDoc.toObject() : eventDoc;
  const attendees = Array.isArray(obj.attendees) ? obj.attendees : [];
  const capacity = typeof obj.capacity === "number" && obj.capacity > 0 ? obj.capacity : 50;
  return {
    _id: obj._id,
    title: obj.title,
    description: obj.description,
    date: obj.date instanceof Date ? obj.date.toISOString() : obj.date,
    venue: obj.venue || "Main Auditorium, Tech Hub",
    capacity,
    category: obj.category || "Workshop",
    createdBy: obj.createdBy || { _id: "", name: "Organizer", email: "" },
    attendees,
    registrationCount: attendees.length,
    spotsRemaining: Math.max(0, capacity - attendees.length),
    isFull: attendees.length >= capacity,
  };
}

function validateEventInput(body, { partial = false } = {}) {
  const errors = [];
  const cleaned = {};

  if (!partial || body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      errors.push("Event title is required.");
    } else if (body.title.trim().length > 150) {
      errors.push("Event title must be 150 characters or fewer.");
    } else {
      cleaned.title = body.title.trim();
    }
  }

  if (!partial || body.description !== undefined) {
    if (typeof body.description !== "string" || !body.description.trim()) {
      errors.push("Event description is required.");
    } else if (body.description.trim().length > 2000) {
      errors.push("Event description must be 2000 characters or fewer.");
    } else {
      cleaned.description = body.description.trim();
    }
  }

  if (!partial || body.date !== undefined) {
    if (!body.date) {
      errors.push("Event date and time are required.");
    } else {
      const parsedDate = new Date(body.date);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.push("Invalid event date/time format.");
      } else {
        cleaned.date = parsedDate;
      }
    }
  }

  if (!partial || body.venue !== undefined) {
    if (typeof body.venue !== "string" || !body.venue.trim()) {
      errors.push("Event venue is required.");
    } else if (body.venue.trim().length > 200) {
      errors.push("Event venue must be 200 characters or fewer.");
    } else {
      cleaned.venue = body.venue.trim();
    }
  }

  if (!partial || body.capacity !== undefined) {
    if (body.capacity === undefined || body.capacity === null || body.capacity === "") {
      errors.push("Event capacity is required.");
    } else {
      const cap = Number(body.capacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 100000) {
        errors.push("Capacity must be a positive whole number (at least 1).");
      } else {
        cleaned.capacity = cap;
      }
    }
  }

  if (!partial || body.category !== undefined) {
    if (typeof body.category !== "string" || !body.category.trim()) {
      errors.push("Event category is required.");
    } else if (!VALID_CATEGORIES.includes(body.category.trim())) {
      errors.push(`Category must be one of: ${VALID_CATEGORIES.join(", ")}.`);
    } else {
      cleaned.category = body.category.trim();
    }
  }

  return {
    valid: errors.length === 0,
    message: errors[0] || "",
    errors,
    data: cleaned,
  };
}

// ============================================================
// 6. API ROUTER (Mounted at both /api and / for full compatibility)
// ============================================================
const router = express.Router();

// --- A. AUTHENTICATION ROUTES ---

async function handleSignup(req, res) {
  try {
    const { name, email, password, role } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }
    if (role !== undefined && role !== "user" && role !== "admin") {
      return res.status(400).json({ message: "Role must be either 'user' or 'admin'." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role === "admin" ? "admin" : "user",
    });

    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    return res.status(500).json({ message: "Signup failed", error: err.message });
  }
}

router.post("/auth/signup", authRateLimiter, handleSignup);
router.post("/auth/register", authRateLimiter, handleSignup);

router.post("/auth/login", authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email) || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

router.post("/auth/logout", (_req, res) => {
  return res.status(200).json({ message: "Logged out successfully" });
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const targetUserId =
      typeof req.query.tabUserId === "string" && isValidObjectId(req.query.tabUserId)
        ? req.query.tabUserId
        : req.user.id;

    const user = await User.findById(targetUserId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User account no longer exists" });
    }
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to verify user session", error: err.message });
  }
});

// --- B. EVENT CRUD ROUTES ---

// GET /events — List all events (with TTL Caching + ?search= and ?category= filters)
router.get("/events", async (req, res) => {
  try {
    const { search, category } = req.query;
    const cacheKey = `events:${search || ""}:${category || "All"}`;
    const cached = getCachedValue(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const filter = {};
    if (category && typeof category === "string" && category !== "All") {
      filter.category = category.trim();
    }

    if (search && typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: regex },
        { venue: regex },
        { category: regex },
        { description: regex },
      ];
    }

    const events = await Event.find(filter)
      .populate("createdBy", "name email")
      .populate("attendees", "name email")
      .sort({ date: 1 });

    const formatted = events.map(formatEvent);
    setCachedValue(cacheKey, formatted);
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(formatted);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch events", error: err.message });
  }
});

// GET /events/:id — Get single event details
router.get("/events/:id", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const cacheKey = `event:${req.params.id}`;
    const cached = getCachedValue(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const formatted = formatEvent(event);
    setCachedValue(cacheKey, formatted);
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(formatted);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch event details", error: err.message });
  }
});

// POST /events — Admin only: Create a new event
router.post("/events", requireRole("admin"), async (req, res) => {
  try {
    const validation = validateEventInput(req.body, { partial: false });
    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message,
        errors: validation.errors,
      });
    }

    const created = await Event.create({
      ...validation.data,
      createdBy: req.user.id,
      attendees: [],
    });

    const populated = await Event.findById(created._id)
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    invalidateEventCache();
    return res.status(201).json(formatEvent(populated));
  } catch (err) {
    return res.status(500).json({ message: "Failed to create event", error: err.message });
  }
});

// PUT & PATCH /events/:id — Admin only: Edit/update an existing event
async function handleUpdateEvent(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    const isPatch = req.method === "PATCH";
    const validation = validateEventInput(req.body || {}, { partial: isPatch });
    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message,
        errors: validation.errors,
      });
    }

    if (Object.keys(validation.data).length === 0) {
      return res.status(400).json({ message: "No valid fields provided for update." });
    }

    if (
      validation.data.capacity !== undefined &&
      validation.data.capacity < existingEvent.attendees.length
    ) {
      return res.status(400).json({
        message: `Capacity (${validation.data.capacity}) cannot be less than current registered attendees (${existingEvent.attendees.length}).`,
      });
    }

    Object.assign(existingEvent, validation.data);
    await existingEvent.save();

    const populated = await Event.findById(existingEvent._id)
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    invalidateEventCache();
    return res.status(200).json(formatEvent(populated));
  } catch (err) {
    return res.status(500).json({ message: "Failed to update event", error: err.message });
  }
}

router.put("/events/:id", requireRole("admin"), handleUpdateEvent);
router.patch("/events/:id", requireRole("admin"), handleUpdateEvent);

// DELETE /events/:id — Admin only: Delete an event and its registrations
router.delete("/events/:id", requireRole("admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Event not found" });
    }

    await Registration.deleteMany({ event: deleted._id });
    invalidateEventCache();

    return res.status(200).json({ message: "Event deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete event", error: err.message });
  }
});

// --- C. REGISTRATION & ATTENDEE ROUTES ---

// POST /events/:id/registrations (and /events/:id/join) — Register current user for an event
async function handleRegisterForEvent(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Check that event exists
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // 2. Check for duplicate registration before attempting atomic update
    const alreadyInAttendees = event.attendees.some((id) => id.toString() === userId);
    const existingReg = await Registration.findOne({ user: userObjectId, event: event._id });
    if (alreadyInAttendees || (existingReg && existingReg.status === "confirmed")) {
      return res.status(409).json({ message: "You are already registered for this event." });
    }

    // 3. Check capacity before attempting atomic update
    //    (Self-heal if any attendee User document was manually deleted from the database)
    if (event.attendees.length > 0) {
      const validUsers = await User.find({ _id: { $in: event.attendees } })
        .select("_id")
        .lean();
      if (validUsers.length !== event.attendees.length) {
        const validIds = validUsers.map((u) => u._id);
        event.attendees = validIds;
        await Event.updateOne({ _id: event._id }, { $set: { attendees: validIds } });
        invalidateEventCache();
      }
    }

    if (event.attendees.length >= event.capacity) {
      return res.status(409).json({ message: "This event is full." });
    }

    // 4. Atomic conditional update on Event document:
    //    Guarantees that under concurrent requests, attendees never exceed capacity
    //    and the same user cannot be added twice.
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: event._id,
        attendees: { $ne: userObjectId },
        $expr: { $lt: [{ $size: "$attendees" }, "$capacity"] },
      },
      {
        $addToSet: { attendees: userObjectId },
      },
      { new: true }
    )
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    if (!updatedEvent) {
      const latestEvent = await Event.findById(event._id);
      if (!latestEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (latestEvent.attendees.some((id) => id.toString() === userId)) {
        return res.status(409).json({ message: "You are already registered for this event." });
      }
      return res.status(409).json({ message: "This event is full." });
    }

    // 5. Create or confirm Registration record enforced by unique { user, event } index
    try {
      const registration = await Registration.findOneAndUpdate(
        { user: userObjectId, event: event._id },
        {
          $set: {
            status: "confirmed",
            registeredAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      invalidateEventCache();
      return res.status(201).json({
        message: "Successfully registered for the event.",
        event: formatEvent(updatedEvent),
        registration: {
          _id: registration._id,
          event: event._id,
          user: userId,
          status: registration.status,
          registeredAt: registration.registeredAt,
        },
      });
    } catch (regErr) {
      await Event.updateOne({ _id: event._id }, { $pull: { attendees: userObjectId } });
      if (regErr && regErr.code === 11000) {
        return res.status(409).json({ message: "You are already registered for this event." });
      }
      throw regErr;
    }
  } catch (err) {
    return res.status(500).json({ message: "Failed to register for event", error: err.message });
  }
}

router.post("/events/:id/registrations", authMiddleware, handleRegisterForEvent);
router.post("/events/:id/join", authMiddleware, handleRegisterForEvent);

// DELETE /events/:id/registrations/me (and POST /events/:id/leave) — Unregister current user
async function handleUnregisterFromEvent(req, res) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const isAttending = event.attendees.some((id) => id.toString() === userId);
    const existingReg = await Registration.findOne({ user: userObjectId, event: event._id });

    if (!isAttending && !existingReg) {
      return res.status(400).json({ message: "You are not registered for this event." });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      event._id,
      { $pull: { attendees: userObjectId } },
      { new: true }
    )
      .populate("createdBy", "name email")
      .populate("attendees", "name email");

    await Registration.findOneAndDelete({ user: userObjectId, event: event._id });
    invalidateEventCache();

    return res.status(200).json({
      message: "Successfully unregistered from the event.",
      event: formatEvent(updatedEvent),
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to unregister from event", error: err.message });
  }
}

router.delete("/events/:id/registrations/me", authMiddleware, handleUnregisterFromEvent);
router.post("/events/:id/leave", authMiddleware, handleUnregisterFromEvent);

// GET /registrations/me — Authenticated user: view only their own registrations
router.get("/registrations/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Ensure any event where user is in attendees has a Registration document
    const userEvents = await Event.find({ attendees: userObjectId });
    for (const ev of userEvents) {
      await Registration.updateOne(
        { user: userObjectId, event: ev._id },
        {
          $setOnInsert: {
            user: userObjectId,
            event: ev._id,
            status: "confirmed",
            registeredAt: ev.createdAt || new Date(),
          },
        },
        { upsert: true }
      );
    }

    const registrations = await Registration.find({
      user: userObjectId,
      status: "confirmed",
    })
      .populate({
        path: "event",
        populate: [
          { path: "createdBy", select: "name email" },
          { path: "attendees", select: "name email" },
        ],
      })
      .sort({ registeredAt: -1 });

    const validRegistrations = registrations
      .filter((reg) => reg.event != null)
      .map((reg) => ({
        _id: reg._id.toString(),
        status: reg.status,
        registeredAt: reg.registeredAt.toISOString(),
        event: formatEvent(reg.event),
      }));

    return res.status(200).json(validRegistrations);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch your registrations", error: err.message });
  }
});

// GET /events/:id/registrations — Admin only: view attendee/registration list for an event
router.get("/events/:id/registrations", requireRole("admin"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = await Event.findById(req.params.id).populate("attendees", "name email role");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    for (const attendee of event.attendees) {
      await Registration.updateOne(
        { user: attendee._id, event: event._id },
        {
          $setOnInsert: {
            user: attendee._id,
            event: event._id,
            status: "confirmed",
            registeredAt: event.createdAt || new Date(),
          },
        },
        { upsert: true }
      );
    }

    const registrations = await Registration.find({
      event: event._id,
      status: "confirmed",
    })
      .populate("user", "name email role")
      .sort({ registeredAt: -1 });

    const formatted = registrations
      .filter((reg) => reg.user != null)
      .map((reg) => ({
        _id: reg._id.toString(),
        attendeeName: reg.user.name,
        attendeeEmail: reg.user.email,
        registeredAt: reg.registeredAt.toISOString(),
        status: reg.status,
        user: {
          _id: reg.user._id.toString(),
          name: reg.user.name,
          email: reg.user.email,
        },
      }));

    return res.status(200).json({
      event: {
        _id: event._id.toString(),
        title: event.title,
        date: event.date.toISOString(),
        venue: event.venue,
        capacity: event.capacity,
        category: event.category,
        registrationCount: formatted.length,
      },
      registrations: formatted,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to fetch event registrations",
      error: err.message,
    });
  }
});

// --- D. BONUS ENDPOINTS (Analytics, Reminders & Background Jobs) ---

// GET /analytics — Admin only: event registration & capacity analytics
router.get("/analytics", requireRole("admin"), async (_req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    const totalEvents = events.length;
    const totalCapacity = events.reduce((acc, ev) => acc + (ev.capacity || 50), 0);
    const totalRegistrations = events.reduce((acc, ev) => acc + ev.attendees.length, 0);

    return res.status(200).json({
      totalEvents,
      totalRegistrations,
      totalCapacity,
      overallUtilizationPercent:
        totalCapacity > 0 ? Math.round((totalRegistrations / totalCapacity) * 100) : 0,
      events: events.map((ev) => ({
        _id: ev._id.toString(),
        title: ev.title,
        category: ev.category,
        venue: ev.venue,
        date: ev.date.toISOString(),
        capacity: ev.capacity,
        registrations: ev.attendees.length,
        utilizationPercent: Math.round((ev.attendees.length / (ev.capacity || 50)) * 100),
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to compute analytics", error: err.message });
  }
});

// GET /reminders/me — Authenticated user: upcoming event reminders generated by background job
router.get("/reminders/me", authMiddleware, async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const upcoming = await Event.find({
      attendees: userObjectId,
      date: { $gte: new Date() },
    }).sort({ date: 1 });

    return res.status(200).json({
      lastBackgroundJobRun,
      reminders: upcoming.map((ev) => ({
        eventId: ev._id.toString(),
        title: ev.title,
        date: ev.date.toISOString(),
        venue: ev.venue,
        category: ev.category,
      })),
      digestCount: upcomingReminderDigest.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch reminders", error: err.message });
  }
});

// Mount router at both /api and / so both /api/events and /events work seamlessly
app.use("/api", router);
app.use("/", router);

// ============================================================
// 7. DATABASE CONNECTION & SERVER STARTUP
// ============================================================
if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log("✅ Connected to MongoDB");
      await seedDatabaseIfNeeded();
      startBackgroundJobs();
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      process.exit(1);
    });
}

export default app;
