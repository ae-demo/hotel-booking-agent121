// Charges the traveler at booking time via the external internal-payments-api.
//
// NOTE — design gap, not a shortcut: the pinned contract at
// specs/design/dependencies/internal-payments-api/openapi.yaml has no
// refund/void/cancel-payment operation (only POST /payments to authorise a
// charge, GET /payments[/{id}], and POST /payouts — which pays a MERCHANT's
// balance out, unrelated to reversing a traveler's charge). So cancelMyBooking
// cannot call a reversal endpoint that does not exist; it marks the booking
// itself `cancelled` locally, which is the extent of "refund" the real
// payment contract allows. Reported in the issue comment and the final
// report — build nothing the spec does not declare.

import hotel_booking_api.paymentsclient;

// Never a required env var (per component contract): an unset
// PAYMENT_API_BASE_URL falls back to the payments client's own documented
// default rather than failing client construction on an empty URL.
final paymentsclient:Client paymentsClient = check new (serviceUrl = effectivePaymentApiBaseUrl());

function effectivePaymentApiBaseUrl() returns string {
    string configured = paymentApiBaseUrl.trim();
    if configured == "" {
        return "http://localhost:8080/v1";
    }
    if configured.endsWith("/") {
        return configured.substring(0, configured.length() - 1);
    }
    return configured;
}

// The service layer's own shape for a charge outcome — keeps the generated
// payments client's types out of service.bal.
type ChargeResult record {|
    boolean authorized;
    string paymentId;
    string status;
|};

// Authorises a charge for a booking. "authorized" confirms the booking;
// anything else — "declined" or "pending" — means no confirmed booking is
// created (a pending charge is treated as not yet paid: this contract models
// no interim/held booking state, so it is refused the same as a decline).
function chargeTraveler(string merchantId, float totalAmount, string bookingReference)
        returns ChargeResult|error {
    int amountMinorUnits = <int>(totalAmount * 100.0);
    paymentsclient:CreatePaymentRequest request = {
        merchantId: merchantId,
        amount: amountMinorUnits,
        currency: "USD",
        channel: "web",
        reference: bookingReference
    };
    paymentsclient:Payment payment = check paymentsClient->/payments.post(request);
    return {
        authorized: payment.status == "authorized",
        paymentId: payment.paymentId,
        status: payment.status
    };
}
