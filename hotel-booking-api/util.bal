import ballerina/time;

// Nights between two date-only (YYYY-MM-DD) strings. Appends a midnight UTC
// time-of-day so the RFC3339 parser accepts a date-only value.
function nightsBetween(string checkInDate, string checkOutDate) returns int|error {
    time:Utc checkInUtc = check time:utcFromString(checkInDate + "T00:00:00.000Z");
    time:Utc checkOutUtc = check time:utcFromString(checkOutDate + "T00:00:00.000Z");
    time:Seconds diffSeconds = time:utcDiffSeconds(checkOutUtc, checkInUtc);
    decimal nightsDecimal = diffSeconds / <decimal>86400;
    return <int>nightsDecimal;
}
