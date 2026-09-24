Feature: Managing existing bookings

  @story-6
  Rule: A traveler can see their own upcoming bookings

    Scenario: Listing upcoming bookings
      Given Maya has a confirmed booking in "Rome"
      When Maya asks the agent to show her bookings
      Then her booking in "Rome" is included in what the agent shows her

  @story-6 @negative
  Rule: A traveler cannot see another traveler's bookings

    Scenario: One traveler's bookings are invisible to another
      Given Devon has a confirmed booking in "Lisbon"
      When Maya asks the agent to show her bookings
      Then Devon's booking in "Lisbon" is not among them

  @story-7
  Rule: A traveler can cancel their own booking, and it is refunded

    Scenario: Cancelling an upcoming booking
      Given Maya has a confirmed booking in "Rome"
      When Maya asks the agent to cancel her booking in "Rome"
      Then that booking's status is cancelled and its payment is refunded

  @story-7 @negative
  Rule: A traveler cannot cancel someone else's booking

    Scenario: Cancelling someone else's booking is refused
      Given Devon has a confirmed booking in "Lisbon"
      When Maya asks the agent to cancel Devon's booking in "Lisbon"
      Then Devon's booking in "Lisbon" is still confirmed
