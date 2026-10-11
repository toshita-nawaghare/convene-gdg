// ============================================================
// Standalone Database Seed Script (Idempotent & Non-Destructive)
// Usage: cd backend && npm run seed
// ============================================================

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });
process.env.NODE_ENV = "test"; // Prevent server.js from starting an HTTP listener during seed

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/event_manager";

async function runSeed() {
  try {
    const { seedDatabaseIfNeeded } = await import("./server.js");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB for seeding");
    await seedDatabaseIfNeeded();
    console.log("✅ Database seed & backfill completed successfully");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
}

runSeed();
