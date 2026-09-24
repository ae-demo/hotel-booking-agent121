// mock/handlers.ts — the SERVICE half of mock mode (mock-mode.md). The gateway
// half (mock/authz/gateway.ts) enforces every operation the project's
// openapi.yaml contracts declare; hotel-booking-agent is an ai-agent
// dependency with no such contract, so no entry in that table matches
// `/api/chat` and every request here reaches this handler directly — exactly
// as the real deployed agent's webchat interface has no per-operation scope to
// enforce either. The screen gate (src/authz/screens.ts, loads: null) is what
// keeps this reachable only once a session exists.
//
// State lives in module scope, so it behaves like an app for as long as the
// tab stays on the SPA: a booking made a moment ago shows up in "my
// bookings", and cancelling it flips its status. Any full page load — a
// reload, a typed URL — re-runs this module and resets the seed.
//
// This is a SCRIPTED stand-in for the real hotel-booking-agent, not a model:
// it pattern-matches the traveler's message well enough to walk every story
// (search, compare, book, pay, view, cancel) with options, confirmations and
// failures rendered the way the real agent's replies would be.

import { http, HttpResponse, type RequestHandler } from "msw";

interface MockHotel {
  id: string;
  name: string;
  city: string;
  rating: number;
  pricePerNight: number;
}

interface MockBooking {
  id: string;
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  status: "confirmed" | "cancelled";
}

const HOTELS: MockHotel[] = [
  { id: "h1", name: "Hôtel Lumière", city: "Paris", rating: 4.5, pricePerNight: 180 },
  { id: "h2", name: "Le Marais Suites", city: "Paris", rating: 4.2, pricePerNight: 150 },
  { id: "h3", name: "Seine View Inn", city: "Paris", rating: 4.0, pricePerNight: 120 },
];

interface ConversationState {
  bookings: MockBooking[];
  lastQuoted?: { hotel: MockHotel; nights: number; total: number };
  nextBookingId: number;
}

const conversations = new Map<string, ConversationState>();

function stateFor(conversationId: string): ConversationState {
  let state = conversations.get(conversationId);
  if (!state) {
    state = { bookings: [], nextBookingId: 1 };
    conversations.set(conversationId, state);
  }
  return state;
}

function newConversationId(): string {
  return `mock-conv-${Math.random().toString(36).slice(2, 10)}`;
}

function reply(conversationId: string, text: string) {
  return HttpResponse.json({ conversationId, text, toolCalls: [] as unknown[] });
}

export const handlers: RequestHandler[] = [
  http.post("/api/chat", async ({ request }) => {
    const body = (await request.json()) as { conversationId?: string; message?: string };
    const message = (body.message ?? "").trim();
    if (!message) {
      return HttpResponse.json({ error: "message is required" }, { status: 400 });
    }
    const conversationId = body.conversationId ?? newConversationId();
    const state = stateFor(conversationId);
    const text = lower(message);

    // Cancel a booking.
    if (text.includes("cancel")) {
      const active = state.bookings.find((b) => b.status === "confirmed");
      if (!active) {
        return reply(conversationId, "You don't have any active bookings to cancel.");
      }
      active.status = "cancelled";
      return reply(
        conversationId,
        `Done — your booking at ${active.hotelName} (${active.checkInDate} to ${active.checkOutDate}) is cancelled and refunded.`,
      );
    }

    // View existing bookings.
    if (text.includes("my booking") || text.includes("my reservation") || text.includes("view my")) {
      if (state.bookings.length === 0) {
        return reply(conversationId, "You don't have any bookings yet — want to search for a hotel?");
      }
      const lines = state.bookings.map(
        (b) => `${b.hotelName}, ${b.checkInDate} to ${b.checkOutDate} — $${b.totalAmount} (${b.status})`,
      );
      return reply(conversationId, `Here are your bookings:\n${lines.join("\n")}`);
    }

    // Payment failure demo, e.g. "book it with a declined card".
    if (state.lastQuoted && (text.includes("decline") || text.includes("fail payment"))) {
      return reply(
        conversationId,
        "The charge failed and the booking was not made. Want to try a different card?",
      );
    }

    // Confirm a quoted booking.
    if (state.lastQuoted && (text === "yes" || text.includes("confirm") || text.includes("book it"))) {
      const { hotel, nights, total } = state.lastQuoted;
      const booking: MockBooking = {
        id: `b${state.nextBookingId++}`,
        hotelName: hotel.name,
        checkInDate: "2026-11-10",
        checkOutDate: "2026-11-13",
        totalAmount: total,
        status: "confirmed",
      };
      state.bookings.push(booking);
      state.lastQuoted = undefined;
      return reply(
        conversationId,
        `Booked and paid — ${hotel.name} for ${nights} nights, total $${total}. Confirmation ${booking.id}.`,
      );
    }

    // A destination mentioned — search and quote the top hotel.
    const cityMatch = HOTELS.find((h) => text.includes(h.city.toLowerCase()));
    if (cityMatch || text.includes("paris") || /\d/.test(text)) {
      const options = HOTELS.map(
        (h) => `${h.name} — $${h.pricePerNight}/night, rated ${h.rating}`,
      ).join("\n");
      const top = HOTELS[0];
      const nights = 3;
      const total = top.pricePerNight * nights;
      state.lastQuoted = { hotel: top, nights, total };
      return reply(
        conversationId,
        `Here are 3 matching hotels in Paris for those dates:\n${options}\n\n` +
          `${top.name} for ${nights} nights comes to $${total} — shall I book it?`,
      );
    }

    // No destination/dates yet — ask for them, as the agent's own instructions do.
    return reply(
      conversationId,
      "Sure — where would you like to stay, and what are your check-in and check-out dates and guest count?",
    );
  }),
];

function lower(value: string): string {
  return value.toLowerCase();
}
