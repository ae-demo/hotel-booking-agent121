import ballerina/http;
import ballerina/sql;
import ballerina/uuid;

listener http:Listener ep0 = new (9090);

service http:InterceptableService / on ep0 {

    public function createInterceptors() returns AssertionInterceptor => new;

    // Search hotels by destination, dates and preferences — every matching hotel.
    // Scope `hotels:search` is enforced at the gateway; no caller identity is
    // needed to serve every-row search results.
    resource function get hotels(string? destination, string? checkInDate, string? checkOutDate,
            int? guests, int 'limit = 20, int offset = 0) returns HotelPage|ErrorBadRequest|error {
        if 'limit < 1 || 'limit > 100 {
            return <ErrorBadRequest>{body: {code: 400, message: "limit must be between 1 and 100"}};
        }
        if offset < 0 {
            return <ErrorBadRequest>{body: {code: 400, message: "offset must not be negative"}};
        }
        int total = check countHotels(destination, guests, checkInDate, checkOutDate);
        HotelRow[] rows = check searchHotels(destination, guests, checkInDate, checkOutDate, 'limit, offset);
        Hotel[] hotels = from HotelRow row in rows
            select hotelRowToApi(row);
        return {count: total, data: hotels};
    }

    // Rooms available at a hotel for the given dates.
    resource function get hotels/[string hotelId]/rooms(string? checkInDate, string? checkOutDate)
            returns RoomPage|ErrorNotFound|error {
        boolean exists = check hotelExists(hotelId);
        if !exists {
            return <ErrorNotFound>{body: {code: 404, message: "no such hotel"}};
        }
        RoomRow[] rows = check roomsForHotel(hotelId, checkInDate, checkOutDate);
        Room[] rooms = from RoomRow row in rows
            select roomRowToApi(row);
        return {count: rooms.length(), data: rooms};
    }

    // The caller's own bookings.
    resource function get me/bookings(http:RequestContext ctx, int 'limit = 20, int offset = 0)
            returns BookingPage|http:Unauthorized|error {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        int total = check countMyBookings(caller.userId);
        BookingRow[] rows = check listMyBookings(caller.userId, 'limit, offset);
        Booking[] bookings = from BookingRow row in rows
            select bookingRowToApi(row);
        return {count: total, data: bookings};
    }

    // One of the caller's own bookings — a booking that exists but is not
    // theirs is a 404, never a 403.
    resource function get me/bookings/[string bookingId](http:RequestContext ctx)
            returns Booking|ErrorNotFound|http:Unauthorized|error {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        BookingRow|error row = getMyBooking(bookingId, caller.userId);
        if row is sql:NoRowsError {
            return <ErrorNotFound>{body: {code: 404, message: "no such booking"}};
        }
        if row is error {
            return row;
        }
        return bookingRowToApi(row);
    }

    // Book and pay for a room: validate availability, charge the traveler via
    // the internal payments API, persist a confirmed booking only when the
    // charge is authorized.
    resource function post me/bookings(http:RequestContext ctx, NewBooking payload)
            returns BookingCreated|ErrorBadRequest|ErrorPaymentRequired|ErrorNotFound|http:Unauthorized|error {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        if payload.checkInDate >= payload.checkOutDate {
            return <ErrorBadRequest>{body: {code: 400, message: "checkOutDate must be after checkInDate"}};
        }
        RoomRow|error room = getRoom(payload.roomId);
        if room is sql:NoRowsError {
            return <ErrorNotFound>{body: {code: 404, message: "no such room"}};
        }
        if room is error {
            return room;
        }
        if !room.available {
            return <ErrorBadRequest>{body: {code: 400, message: "room is not available"}};
        }
        boolean overlap = check roomHasOverlap(payload.roomId, payload.checkInDate, payload.checkOutDate);
        if overlap {
            return <ErrorBadRequest>{body: {code: 400, message: "room is already booked for those dates"}};
        }
        int nights = check nightsBetween(payload.checkInDate, payload.checkOutDate);
        if nights < 1 {
            return <ErrorBadRequest>{body: {code: 400, message: "checkOutDate must be after checkInDate"}};
        }
        float totalAmount = room.pricePerNight * <float>nights;
        string bookingId = uuid:createRandomUuid();

        ChargeResult|error charge = chargeTraveler(room.hotelId, totalAmount, bookingId);
        if charge is error {
            return charge;
        }
        if !charge.authorized {
            return <ErrorPaymentRequired>{body: {
                code: 402,
                message: "payment declined",
                description: "the payment gateway returned status '" + charge.status + "'"
            }};
        }

        BookingRow booking = {
            id: bookingId,
            travelerId: caller.userId,
            roomId: payload.roomId,
            checkInDate: payload.checkInDate,
            checkOutDate: payload.checkOutDate,
            status: "confirmed",
            totalAmount: totalAmount,
            paymentRef: charge.paymentId
        };
        check insertBooking(booking);
        return <BookingCreated>{body: bookingRowToApi(booking)};
    }

    // Cancel one of the caller's own bookings.
    //
    // NOTE — design gap: the pinned internal-payments-api contract has no
    // refund/reversal operation, so there is nothing to call here to reverse
    // the charge. Cancelling marks the booking `cancelled` locally, which is
    // the extent of "refund" that contract allows (see payments.bal).
    resource function post me/bookings/[string bookingId]/cancel(http:RequestContext ctx)
            returns Booking|ErrorNotFound|ErrorConflict|http:Unauthorized|error {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        BookingRow|error row = getMyBooking(bookingId, caller.userId);
        if row is sql:NoRowsError {
            return <ErrorNotFound>{body: {code: 404, message: "no such booking"}};
        }
        if row is error {
            return row;
        }
        if row.status == "cancelled" {
            return <ErrorConflict>{body: {code: 409, message: "booking already cancelled"}};
        }
        check cancelBookingRow(bookingId, caller.userId);
        row.status = "cancelled";
        return bookingRowToApi(row);
    }
}
