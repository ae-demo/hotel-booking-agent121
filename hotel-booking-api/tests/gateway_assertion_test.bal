// Verifies the gateway assertion interceptor copied into gateway_assertion.bal
// (see the ballerina skill's "Who the caller is" section). GATEWAY_ASSERTION_
// CERTIFICATE / _ISSUER / _HEADER must be exported as real OS environment
// variables BEFORE `bal test` starts — the interceptor reads them once, at
// service init, with a throwaway RSA keypair minted for this suite only:
//
//   export GATEWAY_ASSERTION_CERTIFICATE="$(cat tests/resources/gateway-cert1.pem)"
//   export GATEWAY_ASSERTION_ISSUER="test-gateway"
//   export GATEWAY_ASSERTION_HEADER="x-jwt-assertion"
//   bal test
//
// The DB-backed resources under test (GET /me/bookings, GET /hotels) never
// touch Postgres here: their query functions are mocked below, per
// tests.md's "wrap ... so @test:Mock can replace it" guidance, applied to
// the module's own query functions rather than the client itself.
import ballerina/crypto;
import ballerina/http;
import ballerina/jwt;
import ballerina/test;

const string ASSERTION_HEADER = "x-jwt-assertion";
const string TEST_ISSUER = "test-gateway";

final http:Client testClient = check new ("http://localhost:9090");

@test:Mock {
    functionName: "countHotels"
}
test:MockFunction countHotelsMock = new ();

@test:Mock {
    functionName: "searchHotels"
}
test:MockFunction searchHotelsMock = new ();

@test:Mock {
    functionName: "countMyBookings"
}
test:MockFunction countMyBookingsMock = new ();

@test:Mock {
    functionName: "listMyBookings"
}
test:MockFunction listMyBookingsMock = new ();

@test:BeforeSuite
function setupMocks() {
    test:when(countHotelsMock).thenReturn(0);
    test:when(searchHotelsMock).thenReturn(<HotelRow[]>[]);
    test:when(countMyBookingsMock).thenReturn(0);
    test:when(listMyBookingsMock).thenReturn(<BookingRow[]>[]);
}

// Signs a throwaway assertion with the given private key file. `username`
// becomes the JWT `sub` (jwt:issue's own mapping) — the assertion's caller id.
function mintAssertion(string keyFile, string username) returns string|error {
    crypto:PrivateKey privateKey = check crypto:decodeRsaPrivateKeyFromKeyFile(keyFile);
    jwt:IssuerConfig issuerConfig = {
        issuer: TEST_ISSUER,
        username: username,
        expTime: 300,
        customClaims: {"scope": "bookings:read hotels:search", "ouHandle": "acme"},
        signatureConfig: {
            algorithm: jwt:RS256,
            config: privateKey
        }
    };
    return jwt:issue(issuerConfig);
}

// Flips one character deep inside the payload segment so the decoded bytes
// differ from what was signed — the signature can no longer verify, however
// jwt:decode happens to parse (or fail to) the mangled JSON.
function tamperPayload(string token) returns string {
    string[] parts = re `\.`.split(token);
    string payload = parts[1];
    int mid = payload.length() / 2;
    string c = payload.substring(mid, mid + 1);
    string replacement = c == "A" ? "B" : "A";
    string mangled = payload.substring(0, mid) + replacement + payload.substring(mid + 1);
    return parts[0] + "." + mangled + "." + parts[2];
}

@test:Config {}
function testValidAssertionIsAccepted() returns error? {
    string token = check mintAssertion("tests/resources/gateway-key1.pem", "traveler-1");
    http:Response res = check testClient->get("/me/bookings", {[ASSERTION_HEADER]: token});
    test:assertEquals(res.statusCode, 200, "a validly signed assertion must be accepted");
}

@test:Config {}
function testAssertionSignedByDifferentKeyIsRejected() returns error? {
    string token = check mintAssertion("tests/resources/gateway-key2.pem", "traveler-1");
    http:Response res = check testClient->get("/me/bookings", {[ASSERTION_HEADER]: token});
    test:assertEquals(res.statusCode, 401, "a token signed by a key other than the trusted one must be a 401");
}

@test:Config {}
function testTamperedAssertionIsRejected() returns error? {
    string validToken = check mintAssertion("tests/resources/gateway-key1.pem", "traveler-1");
    string tampered = tamperPayload(validToken);
    http:Response res = check testClient->get("/me/bookings", {[ASSERTION_HEADER]: tampered});
    test:assertEquals(res.statusCode, 401, "an assertion edited after signing must never be treated as anonymous");
}

@test:Config {}
function testOperationNeedingNoIdentityIsServedWithoutAnyAssertion() returns error? {
    // GET /hotels needs a valid scope at the gateway but reads no caller
    // identity in the handler, so a request that carries no assertion at all
    // (the shape the gateway serves a security:[] operation with) must still
    // succeed rather than 401 — there is no identity check to fail here.
    http:Response res = check testClient->get("/hotels");
    test:assertEquals(res.statusCode, 200, "a resource that reads no identity must not require an assertion");
}
