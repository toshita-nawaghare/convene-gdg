// ============================================================
// Automated End-to-End API, Duplicate & Concurrency Verification Suite
// Usage: cd backend && npm run verify
// ============================================================

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });
process.env.NODE_ENV = "test";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/event_manager";

async function runVerification() {
  const { default: app, seedDatabaseIfNeeded, User, Event, Registration } = await import(
    "./server.js"
  );

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // 1. Seed default accounts and events
  await seedDatabaseIfNeeded();

  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  function record(step, passed, detail) {
    console.log(`${passed ? "✅ PASS" : "❌ FAIL"} — ${step}: ${detail}`);
    if (!passed) {
      throw new Error(`Verification failed at step: ${step} (${detail})`);
    }
  }

  const ts = Date.now();
  const testEmail = `test.attendee.${ts}@example.com`;
  const concurrentEmails = [1, 2, 3, 4, 5].map((i) => `race.user.${i}.${ts}@example.com`);
  let createdEventId = null;
  let raceEventId = null;

  try {
    // Flow 1: New user signs up and can immediately see all events
    const signupRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Attendee",
        email: testEmail,
        password: "password123",
        role: "user",
      }),
    });
    const signupBody = await signupRes.json();
    record(
      "1. New user signs up",
      signupRes.status === 201 && Boolean(signupBody.token) && !("password" in signupBody.user),
      `Status ${signupRes.status}, user=${signupBody.user?.email}`
    );
    const newUserToken = signupBody.token;

    const newUserEventsRes = await fetch(`${baseUrl}/events`, {
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const newUserEvents = await newUserEventsRes.json();
    record(
      "1b. New user immediately sees all events",
      newUserEventsRes.status === 200 && Array.isArray(newUserEvents) && newUserEvents.length >= 3,
      `Visible events count = ${newUserEvents.length}`
    );

    // Flow 2: Existing user logs in and can see all events
    const aliceLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@test.com", password: "password" }),
    });
    const aliceLogin = await aliceLoginRes.json();
    const aliceEventsRes = await fetch(`${baseUrl}/events`, {
      headers: { Authorization: `Bearer ${aliceLogin.token}` },
    });
    const aliceEvents = await aliceEventsRes.json();
    record(
      "2. Existing user logs in and sees all events",
      aliceLoginRes.status === 200 && aliceEvents.length >= 3,
      `Status ${aliceLoginRes.status}, events count = ${aliceEvents.length}`
    );

    // Admin login
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "password" }),
    });
    const adminLogin = await adminLoginRes.json();
    const adminToken = adminLogin.token;

    // Flow 10a: Admin creates a new event (capacity = 1 to test full-event rejection)
    const createRes = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Verification Cloud Summit",
        description: "End-to-end verification event",
        date: new Date(Date.now() + 86400000 * 10).toISOString(),
        venue: "Hall B, Innovation Center",
        capacity: 1,
        category: "Conference",
      }),
    });
    const createdEvent = await createRes.json();
    createdEventId = createdEvent._id;
    record(
      "10a. Admin can create an event",
      createRes.status === 201 && Boolean(createdEventId),
      `Created event ID=${createdEventId}, capacity=${createdEvent.capacity}`
    );

    // Flow 3: Normal user can view event details
    const detailRes = await fetch(`${baseUrl}/events/${createdEventId}`, {
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const detailBody = await detailRes.json();
    record(
      "3. Normal user can view event details",
      detailRes.status === 200 &&
        detailBody.title === "Verification Cloud Summit" &&
        detailBody.venue === "Hall B, Innovation Center",
      `Status ${detailRes.status}, title="${detailBody.title}"`
    );

    // Flow 4: Normal user can register once
    const regRes = await fetch(`${baseUrl}/events/${createdEventId}/registrations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const regBody = await regRes.json();
    record(
      "4. Normal user can register once",
      regRes.status === 201 && regBody.event.registrationCount === 1,
      `Status ${regRes.status}, registrationCount=${regBody.event?.registrationCount}`
    );

    // Flow 5: Duplicate registration is rejected
    const dupRes = await fetch(`${baseUrl}/events/${createdEventId}/registrations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const dupBody = await dupRes.json();
    record(
      "5. Duplicate registration is rejected",
      dupRes.status === 409 && dupBody.message === "You are already registered for this event.",
      `Status ${dupRes.status}, message="${dupBody.message}"`
    );

    // Flow 6: Registration to a full event is rejected
    const fullRes = await fetch(`${baseUrl}/events/${createdEventId}/registrations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${aliceLogin.token}` },
    });
    const fullBody = await fullRes.json();
    record(
      "6. Registration to a full event is rejected",
      fullRes.status === 409 && fullBody.message === "This event is full.",
      `Status ${fullRes.status}, message="${fullBody.message}"`
    );

    // Flow 6b: CONCURRENCY RACE-CONDITION TEST (5 users simultaneously -> capacity=2 event)
    const raceEventRes = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Concurrency Stress Test Event",
        description: "Testing simultaneous registrations against capacity=2",
        date: new Date(Date.now() + 86400000 * 5).toISOString(),
        venue: "Main Hall",
        capacity: 2,
        category: "Workshop",
      }),
    });
    const raceEvent = await raceEventRes.json();
    raceEventId = raceEvent._id;

    // Create 5 distinct users
    const raceTokens = [];
    for (const email of concurrentEmails) {
      const r = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Race Tester",
          email,
          password: "password123",
          role: "user",
        }),
      });
      const b = await r.json();
      raceTokens.push(b.token);
    }

    // Fire all 5 registration requests AT THE EXACT SAME TIME with Promise.all
    const concurrentResponses = await Promise.all(
      raceTokens.map((token) =>
        fetch(`${baseUrl}/events/${raceEventId}/registrations`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );
    const statusCounts = { 201: 0, 409: 0 };
    for (const r of concurrentResponses) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    const verifyRaceEventRes = await fetch(`${baseUrl}/events/${raceEventId}`);
    const verifyRaceEvent = await verifyRaceEventRes.json();
    record(
      "6b. Concurrency race-condition test (5 parallel requests for capacity=2)",
      statusCounts[201] === 2 &&
        statusCounts[409] === 3 &&
        verifyRaceEvent.registrationCount === 2,
      `201 Created=${statusCounts[201]}, 409 Full=${statusCounts[409]}, final registrationCount=${verifyRaceEvent.registrationCount}/2 (ZERO overflow)`
    );

    // Flow 8: My Registrations shows only the logged-in user's events
    const myRegRes = await fetch(`${baseUrl}/registrations/me`, {
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const myRegBody = await myRegRes.json();
    record(
      "8. My Registrations shows only logged-in user's events",
      myRegRes.status === 200 &&
        myRegBody.length === 1 &&
        myRegBody[0].event._id === createdEventId,
      `Status ${myRegRes.status}, count=${myRegBody.length}`
    );

    // Flow 9: Normal user cannot create/edit/delete events or view attendee lists
    const forbiddenCreate = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newUserToken}`,
      },
      body: JSON.stringify({
        title: "Unauthorized Event",
        description: "Should fail",
        date: new Date().toISOString(),
        venue: "Nowhere",
        capacity: 10,
        category: "Workshop",
      }),
    });
    const forbiddenEdit = await fetch(`${baseUrl}/events/${createdEventId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newUserToken}`,
      },
      body: JSON.stringify({ title: "Hacked" }),
    });
    const forbiddenDelete = await fetch(`${baseUrl}/events/${createdEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const forbiddenAttendees = await fetch(
      `${baseUrl}/events/${createdEventId}/registrations`,
      {
        headers: { Authorization: `Bearer ${newUserToken}` },
      }
    );
    record(
      "9. Normal user cannot create/edit/delete events or view attendee lists",
      forbiddenCreate.status === 403 &&
        forbiddenEdit.status === 403 &&
        forbiddenDelete.status === 403 &&
        forbiddenAttendees.status === 403,
      `Statuses: create=${forbiddenCreate.status}, edit=${forbiddenEdit.status}, delete=${forbiddenDelete.status}, attendees=${forbiddenAttendees.status}`
    );

    // Flow 10b: Admin can edit an event
    const editRes = await fetch(`${baseUrl}/events/${createdEventId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Verification Cloud Summit (Updated)",
        capacity: 25,
      }),
    });
    const editedEvent = await editRes.json();
    record(
      "10b. Admin can edit an event",
      editRes.status === 200 &&
        editedEvent.title === "Verification Cloud Summit (Updated)" &&
        editedEvent.capacity === 25,
      `Status ${editRes.status}, updated title="${editedEvent.title}", capacity=${editedEvent.capacity}`
    );

    // Flow 11: Admin can view attendees for an event
    const attendeesRes = await fetch(`${baseUrl}/events/${createdEventId}/registrations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attendeesBody = await attendeesRes.json();
    record(
      "11. Admin can view attendees for an event",
      attendeesRes.status === 200 &&
        attendeesBody.registrations.length === 1 &&
        attendeesBody.registrations[0].attendeeEmail === testEmail,
      `Status ${attendeesRes.status}, attendee=${attendeesBody.registrations[0]?.attendeeEmail}`
    );

    // Flow 7: Normal user can unregister
    const unregRes = await fetch(`${baseUrl}/events/${createdEventId}/registrations/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    const unregBody = await unregRes.json();
    record(
      "7. Normal user can unregister",
      unregRes.status === 200 && unregBody.event.registrationCount === 0,
      `Status ${unregRes.status}, registrationCount=${unregBody.event?.registrationCount}`
    );

    // Flow 10c: Admin can delete an event
    const delRes = await fetch(`${baseUrl}/events/${createdEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(
      "10c. Admin can delete an event",
      delRes.status === 200,
      `Status ${delRes.status}`
    );
    createdEventId = null;

    // Flow 12: Protected routes reject unauthenticated / signed-out requests
    const unauthMe = await fetch(`${baseUrl}/auth/me`);
    const unauthMyRegs = await fetch(`${baseUrl}/registrations/me`);
    record(
      "12. Protected routes reject unauthenticated access after sign-out",
      unauthMe.status === 401 && unauthMyRegs.status === 401,
      `Statuses: /auth/me=${unauthMe.status}, /registrations/me=${unauthMyRegs.status}`
    );

    console.log("\n🎉 All verification flows (including concurrency race test) passed!");
  } finally {
    // Cleanup temporary test users and test events
    if (createdEventId) {
      await Event.findByIdAndDelete(createdEventId);
      await Registration.deleteMany({ event: createdEventId });
    }
    if (raceEventId) {
      await Event.findByIdAndDelete(raceEventId);
      await Registration.deleteMany({ event: raceEventId });
    }
    await User.deleteMany({ email: { $in: [testEmail, ...concurrentEmails] } });
    server.close();
    await mongoose.disconnect();
  }
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
