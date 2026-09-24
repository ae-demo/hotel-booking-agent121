Feature: Hotel search and booking

  @story-1
  Rule: A traveler must be signed in to use the agent

    @negative
    Scenario: A signed-out visitor cannot book
      Given Maya the traveler is not signed in
      When Maya tries to talk to the booking agent
      Then she is not given any booking capability

  @story-2
  Rule: The agent finds hotels matching what the traveler describes

    Scenario: Searching by destination and dates
      Given Maya the traveler wants to stay in "Paris" from "2026-11-10" to "2026-11-13" for 2 guests
      When Maya describes this trip to the booking agent
      Then the agent returns hotels in "Paris" available for those dates

    @negative
    Scenario: A destination with no available hotels
      Given no hotels are available in "Atlantis" for Maya's dates
      When Maya asks the agent to find a hotel in "Atlantis"
      Then the agent reports no matching hotels

  @story-3
  Rule: The agent presents comparable hotel/room options

    Scenario: Options carry price, rating and amenities
      Given the agent found hotels in "Paris" for Maya's dates
      When Maya asks to see the options
      Then each option shown includes its price, its rating and its amenities

  @story-4 @story-5
  Rule: Booking a room charges the traveler at the time of reservation

    Scenario: A confirmed booking is paid for immediately
      Given Maya has chosen a specific room at a hotel in "Paris"
      When Maya confirms the booking through the agent
      Then a confirmed booking exists for that room with a completed payment

    @negative
    Scenario: A declined payment does not create a confirmed booking
      Given Maya's payment method will be declined
      When Maya confirms the booking through the agent
      Then no confirmed booking exists for that room under Maya's account
