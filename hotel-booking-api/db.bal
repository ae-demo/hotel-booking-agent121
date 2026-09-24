import ballerina/sql;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

// Constructed lazily, on the first query this service actually runs — never
// as a bare module-level statement. Wrapping the connection (and the
// schema/seed step it gates) behind this one function is what lets
// gateway_assertion tests mock every query-level function above it without a
// live Postgres: nothing in this file touches the network until one of the
// functions below is actually called.
postgresql:Client? cachedDbClient = ();
boolean schemaReady = false;

function db() returns postgresql:Client|error {
    postgresql:Client? existing = cachedDbClient;
    if existing is postgresql:Client {
        return existing;
    }
    postgresql:Client newClient = check new (
        host = dbHost,
        username = dbUser,
        password = dbPassword,
        database = dbName,
        port = check int:fromString(dbPortRaw)
    );
    cachedDbClient = newClient;
    check ensureSchema(newClient);
    return newClient;
}

function ensureSchema(postgresql:Client dbClient) returns error? {
    if schemaReady {
        return;
    }
    _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS hotels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            city TEXT NOT NULL,
            address TEXT NOT NULL,
            rating DOUBLE PRECISION NOT NULL
        )
    `);
    _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            hotel_id TEXT NOT NULL REFERENCES hotels(id),
            room_type TEXT NOT NULL,
            capacity INT NOT NULL,
            price_per_night DOUBLE PRECISION NOT NULL,
            available BOOLEAN NOT NULL DEFAULT TRUE
        )
    `);
    // check_in_date/check_out_date are stored as ISO-8601 (YYYY-MM-DD) text:
    // the API only ever reads/writes them as date-only strings, and ISO-8601
    // text compares and orders identically to a DATE column for every query
    // this service runs (overlap checks, ordering) without a date/time
    // conversion at either the read or the write side.
    _ = check dbClient->execute(`
        CREATE TABLE IF NOT EXISTS bookings (
            id TEXT PRIMARY KEY,
            traveler_id TEXT NOT NULL,
            room_id TEXT NOT NULL REFERENCES rooms(id),
            check_in_date TEXT NOT NULL,
            check_out_date TEXT NOT NULL,
            status TEXT NOT NULL,
            total_amount DOUBLE PRECISION NOT NULL,
            payment_ref TEXT NOT NULL
        )
    `);
    check seedCatalog(dbClient);
    schemaReady = true;
}

// Seeds a small, realistic hotel/room catalog. There is no admin surface on
// this component (per design.json) so this is the only way the catalog is
// ever populated; ON CONFLICT DO NOTHING keeps it idempotent across restarts
// and concurrent replicas.
function seedCatalog(postgresql:Client dbClient) returns error? {
    sql:ParameterizedQuery[] hotelInserts = [
        `INSERT INTO hotels (id, name, city, address, rating) VALUES
            ('htl-paris-1', 'Hotel Le Marais', 'Paris', '12 Rue de Rivoli', 4.5)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO hotels (id, name, city, address, rating) VALUES
            ('htl-paris-2', 'Hotel Rive Gauche', 'Paris', '8 Boulevard Saint-Germain', 4.2)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO hotels (id, name, city, address, rating) VALUES
            ('htl-rome-1', 'Grand Roma', 'Rome', 'Via del Corso 45', 4.6)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO hotels (id, name, city, address, rating) VALUES
            ('htl-lisbon-1', 'Lisbon Bay Hotel', 'Lisbon', 'Avenida da Liberdade 200', 4.3)
         ON CONFLICT (id) DO NOTHING`
    ];
    sql:ExecutionResult[] _ = check dbClient->batchExecute(hotelInserts);

    sql:ParameterizedQuery[] roomInserts = [
        `INSERT INTO rooms (id, hotel_id, room_type, capacity, price_per_night, available) VALUES
            ('rm-paris-1-double', 'htl-paris-1', 'double', 2, 150.0, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO rooms (id, hotel_id, room_type, capacity, price_per_night, available) VALUES
            ('rm-paris-1-suite', 'htl-paris-1', 'suite', 4, 280.0, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO rooms (id, hotel_id, room_type, capacity, price_per_night, available) VALUES
            ('rm-paris-2-double', 'htl-paris-2', 'double', 2, 130.0, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO rooms (id, hotel_id, room_type, capacity, price_per_night, available) VALUES
            ('rm-rome-1-double', 'htl-rome-1', 'double', 2, 140.0, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO rooms (id, hotel_id, room_type, capacity, price_per_night, available) VALUES
            ('rm-rome-1-suite', 'htl-rome-1', 'suite', 4, 260.0, TRUE)
         ON CONFLICT (id) DO NOTHING`,
        `INSERT INTO rooms (id, hotel_id, room_type, capacity, price_per_night, available) VALUES
            ('rm-lisbon-1-double', 'htl-lisbon-1', 'double', 2, 120.0, TRUE)
         ON CONFLICT (id) DO NOTHING`
    ];
    sql:ExecutionResult[] _ = check dbClient->batchExecute(roomInserts);
}

// ---- Mapping between stored rows and the wire schemas ----

function hotelRowToApi(HotelRow row) returns Hotel => {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    rating: row.rating
};

function roomRowToApi(RoomRow row) returns Room => {
    id: row.id,
    hotelId: row.hotelId,
    'type: row.roomType,
    capacity: row.capacity,
    pricePerNight: row.pricePerNight,
    available: row.available
};

function bookingRowToApi(BookingRow row) returns Booking => {
    id: row.id,
    roomId: row.roomId,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    status: row.status,
    totalAmount: row.totalAmount,
    paymentRef: row.paymentRef
};

// ---- Hotels ----

function hotelFilters(string? destination, int? guests, string? checkInDate, string? checkOutDate)
        returns sql:ParameterizedQuery[] {
    sql:ParameterizedQuery[] filters = [];
    if destination is string {
        string likePattern = "%" + destination + "%";
        filters.push(`h.city ILIKE ${likePattern}`);
    }
    if guests is int {
        filters.push(`r.capacity >= ${guests}`);
    }
    if checkInDate is string && checkOutDate is string {
        filters.push(`NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.room_id = r.id AND b.status = 'confirmed'
              AND b.check_in_date < ${checkOutDate} AND b.check_out_date > ${checkInDate}
        )`);
    }
    return filters;
}

function withFilters(sql:ParameterizedQuery base, sql:ParameterizedQuery[] filters) returns sql:ParameterizedQuery {
    sql:ParameterizedQuery query = base;
    foreach int i in 0 ..< filters.length() {
        sql:ParameterizedQuery joiner = i == 0 ? ` WHERE ` : ` AND `;
        query = sql:queryConcat(query, joiner, filters[i]);
    }
    return query;
}

function countHotels(string? destination, int? guests, string? checkInDate, string? checkOutDate) returns int|error {
    postgresql:Client dbClient = check db();
    sql:ParameterizedQuery[] filters = hotelFilters(destination, guests, checkInDate, checkOutDate);
    sql:ParameterizedQuery base = `SELECT COUNT(DISTINCT h.id) FROM hotels h JOIN rooms r ON r.hotel_id = h.id AND r.available = TRUE`;
    sql:ParameterizedQuery query = withFilters(base, filters);
    return dbClient->queryRow(query);
}

function searchHotels(string? destination, int? guests, string? checkInDate, string? checkOutDate,
        int 'limit, int offset) returns HotelRow[]|error {
    postgresql:Client dbClient = check db();
    sql:ParameterizedQuery[] filters = hotelFilters(destination, guests, checkInDate, checkOutDate);
    sql:ParameterizedQuery base =
        `SELECT DISTINCT h.id, h.name, h.city, h.address, h.rating FROM hotels h JOIN rooms r ON r.hotel_id = h.id AND r.available = TRUE`;
    sql:ParameterizedQuery query = withFilters(base, filters);
    query = sql:queryConcat(query, ` ORDER BY h.id LIMIT ${'limit} OFFSET ${offset}`);
    stream<HotelRow, sql:Error?> rows = dbClient->query(query);
    HotelRow[] result = [];
    check from HotelRow row in rows
        do {
            result.push(row);
        };
    return result;
}

function hotelExists(string hotelId) returns boolean|error {
    postgresql:Client dbClient = check db();
    int|sql:Error count = dbClient->queryRow(`SELECT COUNT(*) FROM hotels WHERE id = ${hotelId}`);
    if count is sql:Error {
        return count;
    }
    return count > 0;
}

// ---- Rooms ----

function roomsForHotel(string hotelId, string? checkInDate, string? checkOutDate) returns RoomRow[]|error {
    postgresql:Client dbClient = check db();
    sql:ParameterizedQuery query;
    if checkInDate is string && checkOutDate is string {
        query = `SELECT r.id, r.hotel_id AS "hotelId", r.room_type AS "roomType", r.capacity,
                    r.price_per_night AS "pricePerNight",
                    (r.available AND NOT EXISTS (
                        SELECT 1 FROM bookings b
                        WHERE b.room_id = r.id AND b.status = 'confirmed'
                          AND b.check_in_date < ${checkOutDate} AND b.check_out_date > ${checkInDate}
                    )) AS available
                  FROM rooms r WHERE r.hotel_id = ${hotelId} ORDER BY r.id`;
    } else {
        query = `SELECT r.id, r.hotel_id AS "hotelId", r.room_type AS "roomType", r.capacity,
                    r.price_per_night AS "pricePerNight", r.available
                  FROM rooms r WHERE r.hotel_id = ${hotelId} ORDER BY r.id`;
    }
    stream<RoomRow, sql:Error?> rows = dbClient->query(query);
    RoomRow[] result = [];
    check from RoomRow row in rows
        do {
            result.push(row);
        };
    return result;
}

function getRoom(string roomId) returns RoomRow|error {
    postgresql:Client dbClient = check db();
    return dbClient->queryRow(
        `SELECT id, hotel_id AS "hotelId", room_type AS "roomType", capacity,
            price_per_night AS "pricePerNight", available
         FROM rooms WHERE id = ${roomId}`
    );
}

function roomHasOverlap(string roomId, string checkInDate, string checkOutDate) returns boolean|error {
    postgresql:Client dbClient = check db();
    int|sql:Error count = dbClient->queryRow(
        `SELECT COUNT(*) FROM bookings
         WHERE room_id = ${roomId} AND status = 'confirmed'
           AND check_in_date < ${checkOutDate} AND check_out_date > ${checkInDate}`
    );
    if count is sql:Error {
        return count;
    }
    return count > 0;
}

// ---- Bookings — every query here is scoped to the caller's travelerId ----

function countMyBookings(string travelerId) returns int|error {
    postgresql:Client dbClient = check db();
    return dbClient->queryRow(`SELECT COUNT(*) FROM bookings WHERE traveler_id = ${travelerId}`);
}

function listMyBookings(string travelerId, int 'limit, int offset) returns BookingRow[]|error {
    postgresql:Client dbClient = check db();
    stream<BookingRow, sql:Error?> rows = dbClient->query(
        `SELECT id, traveler_id AS "travelerId", room_id AS "roomId",
            check_in_date AS "checkInDate", check_out_date AS "checkOutDate",
            status, total_amount AS "totalAmount", payment_ref AS "paymentRef"
         FROM bookings WHERE traveler_id = ${travelerId}
         ORDER BY id LIMIT ${'limit} OFFSET ${offset}`
    );
    BookingRow[] result = [];
    check from BookingRow row in rows
        do {
            result.push(row);
        };
    return result;
}

function getMyBooking(string bookingId, string travelerId) returns BookingRow|error {
    postgresql:Client dbClient = check db();
    return dbClient->queryRow(
        `SELECT id, traveler_id AS "travelerId", room_id AS "roomId",
            check_in_date AS "checkInDate", check_out_date AS "checkOutDate",
            status, total_amount AS "totalAmount", payment_ref AS "paymentRef"
         FROM bookings WHERE id = ${bookingId} AND traveler_id = ${travelerId}`
    );
}

function insertBooking(BookingRow booking) returns error? {
    postgresql:Client dbClient = check db();
    _ = check dbClient->execute(
        `INSERT INTO bookings (id, traveler_id, room_id, check_in_date, check_out_date, status, total_amount, payment_ref)
         VALUES (${booking.id}, ${booking.travelerId}, ${booking.roomId}, ${booking.checkInDate},
                 ${booking.checkOutDate}, ${booking.status}, ${booking.totalAmount}, ${booking.paymentRef})`
    );
}

function cancelBookingRow(string bookingId, string travelerId) returns error? {
    postgresql:Client dbClient = check db();
    _ = check dbClient->execute(
        `UPDATE bookings SET status = 'cancelled' WHERE id = ${bookingId} AND traveler_id = ${travelerId}`
    );
}
