// GENERATED from specs/design/components/hotel-booking-agent/agent.afm.md's
// x-aep.tools.openapi[] allow-list, against
// specs/design/components/hotel-booking-api/openapi.yaml.
//
// One tool per allowed operationId, and NO others:
//   searchHotels, listHotelRooms, listMyBookings, createMyBooking,
//   getMyBooking, cancelMyBooking
//
// An operation left off that allow-list is never generated here, so no
// phrasing can reach it. Never add one because it "would be useful" —
// regenerate from the design instead.

import { tool } from "ai";
import { z } from "zod";
import { config } from "./config.js";
import { callContext } from "./context.js";

interface ToolResult {
  ok: boolean;
  status: number;
  body: unknown;
}

function baseUrl(): string {
  if (!config.hotelBookingApiUrl) {
    throw new Error("HOTEL_BOOKING_API_URL is not configured");
  }
  return config.hotelBookingApiUrl;
}

/** Joins a path onto the injected base address — never string concatenation,
 * since the injected address may or may not end in "/". */
function buildUrl(path: string, query?: Record<string, unknown>): URL {
  const base = baseUrl();
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const url = new URL(path.replace(/^\//, ""), normalizedBase);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

/** One call() helper for every operation: attaches the caller's own
 * credential (never the model's business), and parses the response
 * defensively — a provider that returns HTML or an empty body on an error
 * must still produce a tool result, not throw. */
async function call(
  method: string,
  path: string,
  options: { query?: Record<string, unknown>; body?: unknown } = {},
): Promise<ToolResult> {
  const { authorization } = callContext.getStore() ?? {};
  const url = buildUrl(path, options.query);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authorization) headers.Authorization = authorization;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

export const tools = {
  searchHotels: tool({
    description:
      "Search hotels by destination, dates and preferences — every matching hotel.",
    inputSchema: z.object({
      destination: z.string().optional().describe("city or place the traveler wants to stay"),
      checkInDate: z.string().optional().describe("YYYY-MM-DD"),
      checkOutDate: z.string().optional().describe("YYYY-MM-DD"),
      guests: z.number().int().optional().describe("number of guests"),
      limit: z.number().int().max(100).optional(),
      offset: z.number().int().optional(),
    }),
    execute: (args) => call("GET", "/hotels", { query: args }),
  }),

  listHotelRooms: tool({
    description: "Rooms available at a hotel for the given dates.",
    inputSchema: z.object({
      hotelId: z.string().describe("the hotel to list rooms for"),
      checkInDate: z.string().optional().describe("YYYY-MM-DD"),
      checkOutDate: z.string().optional().describe("YYYY-MM-DD"),
    }),
    execute: ({ hotelId, ...query }) =>
      call("GET", `/hotels/${encodeURIComponent(hotelId)}/rooms`, { query }),
  }),

  listMyBookings: tool({
    description: "The caller's own bookings.",
    inputSchema: z.object({
      limit: z.number().int().max(100).optional(),
      offset: z.number().int().optional(),
    }),
    execute: (args) => call("GET", "/me/bookings", { query: args }),
  }),

  createMyBooking: tool({
    description: "Book and pay for a room.",
    inputSchema: z.object({
      roomId: z.string().describe("the room to book"),
      checkInDate: z.string().describe("YYYY-MM-DD"),
      checkOutDate: z.string().describe("YYYY-MM-DD"),
    }),
    execute: (body) => call("POST", "/me/bookings", { body }),
  }),

  getMyBooking: tool({
    description: "One of the caller's own bookings.",
    inputSchema: z.object({
      bookingId: z.string().describe("the booking to look up"),
    }),
    execute: ({ bookingId }) =>
      call("GET", `/me/bookings/${encodeURIComponent(bookingId)}`),
  }),

  cancelMyBooking: tool({
    description: "Cancel one of the caller's own bookings and refund it.",
    inputSchema: z.object({
      bookingId: z.string().describe("the booking to cancel"),
    }),
    execute: ({ bookingId }) =>
      call("POST", `/me/bookings/${encodeURIComponent(bookingId)}/cancel`),
  }),
};
