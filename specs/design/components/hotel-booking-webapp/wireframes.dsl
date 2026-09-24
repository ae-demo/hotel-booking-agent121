screen Chat "Talk to the booking agent to search, book and manage your stays"
  navbar "Hotel Booking"
  sidebar "Chat -> Chat"
  card "Conversation"
    list "Agent: Hi! Where would you like to stay? | You: Paris, Nov 10-13 for 2 guests | Agent: Here are 3 matching hotels in Paris for those dates..."
  row
    input "Type a message..."
    right
    button "Send" primary // sends the message and stays on this screen

flow "Book and manage a stay"
  role "Traveler"
  description "A traveler chats with the agent to search, compare, book, pay for, view and cancel their own hotel stays"
  Chat
