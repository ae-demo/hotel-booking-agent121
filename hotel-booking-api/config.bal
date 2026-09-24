// All external configuration, read once at startup. Every other module reads
// through the configurables declared here — never a scattered os:getEnv.
import ballerina/os;

// hotel-booking-db (platform-resource, postgres-cnpg) — envBindings from design.json
configurable string dbHost = os:getEnv("HOTEL_BOOKING_DB_HOST");
configurable string dbPortRaw = os:getEnv("HOTEL_BOOKING_DB_PORT");
configurable string dbName = os:getEnv("HOTEL_BOOKING_DB_DBNAME");
configurable string dbUser = os:getEnv("HOTEL_BOOKING_DB_USER");
configurable string dbPassword = os:getEnv("HOTEL_BOOKING_DB_PASSWORD");

// internal-payments-api (external) — envBindings from design.json
configurable string paymentApiBaseUrl = os:getEnv("PAYMENT_API_BASE_URL");
