# hotel-booking-agent121 — PRD

## Problem Statement

Travelers looking to book a hotel today have to jump between multiple search sites, compare listings by hand, and repeat the same destination/date/preference details on each one before they can even see real options. There is no single place where a traveler can describe what they want in their own words and get a room booked without the manual comparison work.

## Solution

A conversational booking agent that a traveler talks to in natural language — describing destination, dates, budget and preferences — and which searches available hotels and rooms, presents comparable options, and completes the booking (including payment and confirmation) on the traveler's behalf, end to end.

## Actors

- **Traveler** — signs in, describes what they want to the agent, reviews and compares the hotels/rooms it finds, books a room, pays for it, and manages (views, modifies, cancels) their own existing bookings. The only actor in this product; hotel/room inventory is data the system holds, and nobody manages it through this product.

## User Stories

1. As a traveler, I want to sign in, so that my bookings are tied to my own account.
2. As a traveler, I want to describe my destination, travel dates and preferences to the agent in natural language, so that it can find hotels that match without me filling out a search form.
3. As a traveler, I want the agent to show me comparable hotel/room options (price, rating, amenities, availability), so that I can pick the one that fits me best.
4. As a traveler, I want to book a specific room through the agent, so that my stay is reserved.
5. As a traveler, I want to pay for my booking at the time I reserve it, so that my room is confirmed rather than just held.
6. As a traveler, I want to view my existing bookings, so that I can see what I have coming up.
7. As a traveler, I want to cancel an existing booking, so that I'm not charged or held to a stay I no longer want.

## Product Decisions

- Sign-in: every traveler signs in via SSO through Thunder, the platform IDP.
- Payment: bookings are charged through the organization's internal payments API at the time of reservation.
- Hotel and room inventory (properties, rooms, rates, availability) is data the system itself holds — there is no hotel-staff or admin actor managing it through this product, and no external hotel-inventory provider is assumed; it is held as the system's own catalog.

## Out of Scope

- Any hotel-staff, property-manager or admin-facing management of listings, pricing or availability.
- Multi-provider price comparison against external travel sites.
- Group bookings, corporate/negotiated rates, and loyalty/rewards programs.
- Booking confirmation and reminder notifications by email or SMS — the agent's own reply is the confirmation for now.

## Open Questions

1. None currently — all decisions this document depends on are either settled by organization defaults or marked `*assumed*` above for confirmation.

## Further Notes

None.