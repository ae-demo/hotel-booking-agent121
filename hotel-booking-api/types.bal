import ballerina/http;

// ---- Wire types — exactly openapi.yaml's schemas ----

public type Hotel record {|
    string id;
    string name;
    string city;
    string address?;
    float rating;
|};

public type Room record {|
    string id;
    string hotelId;
    // room type, e.g. double, suite
    string 'type;
    int capacity;
    float pricePerNight;
    boolean available?;
|};

public type Booking record {|
    string id;
    string roomId;
    string checkInDate;
    string checkOutDate;
    "confirmed"|"cancelled" status;
    float totalAmount;
    string paymentRef?;
|};

public type NewBooking record {|
    string roomId;
    string checkInDate;
    string checkOutDate;
|};

public type Error record {|
    // HTTP or application error code
    int code;
    // short human-readable label
    string message;
    // detailed explanation
    string description?;
    // URI to documentation
    string moreInfo?;
|};

public type HotelPage record {|
    int count;
    string? next = ();
    string? previous = ();
    Hotel[] data;
|};

public type RoomPage record {|
    int count;
    string? next = ();
    string? previous = ();
    Room[] data;
|};

public type BookingPage record {|
    int count;
    string? next = ();
    string? previous = ();
    Booking[] data;
|};

public type ErrorBadRequest record {|
    *http:BadRequest;
    Error body;
|};

public type ErrorUnauthorized record {|
    *http:Unauthorized;
    Error body;
|};

public type ErrorNotFound record {|
    *http:NotFound;
    Error body;
|};

public type ErrorConflict record {|
    *http:Conflict;
    Error body;
|};

public type ErrorPaymentRequired record {|
    *http:PaymentRequired;
    Error body;
|};

public type BookingCreated record {|
    *http:Created;
    Booking body;
|};

// ---- Internal row shapes — how the catalog and bookings are stored ----

type HotelRow record {|
    string id;
    string name;
    string city;
    string address;
    float rating;
|};

type RoomRow record {|
    string id;
    string hotelId;
    string roomType;
    int capacity;
    float pricePerNight;
    boolean available;
|};

type BookingRow record {|
    string id;
    string travelerId;
    string roomId;
    string checkInDate;
    string checkOutDate;
    "confirmed"|"cancelled" status;
    float totalAmount;
    string paymentRef;
|};
