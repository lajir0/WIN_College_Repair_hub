from __future__ import annotations

import os
from decimal import Decimal

import stripe

from apps.payments.models import PayoutLedgerEntry
from apps.payments.models import PaymentRecord
from apps.repairs.models import Booking, RepairRequest


def create_booking_financials(validated_data: dict[str, object]) -> dict[str, Decimal]:
    repair_request = validated_data["repair_request"]
    selected_quote_amount = Decimal(getattr(repair_request, "selected_quote_amount", 0) or 0)
    subtotal = selected_quote_amount or Decimal(
        getattr(repair_request, "estimated_max_cost", 95) or 95
    )
    platform_fee = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
    total = subtotal + platform_fee
    return {
        "subtotal_amount": subtotal,
        "platform_fee_amount": platform_fee,
        "total_amount": total,
    }


def create_payout_entry(booking: Booking) -> PayoutLedgerEntry:
    return PayoutLedgerEntry.objects.create(
        repairer=booking.repairer,
        booking=booking,
        gross_amount=booking.subtotal_amount,
        platform_fee=booking.platform_fee_amount,
        net_amount=booking.subtotal_amount - booking.platform_fee_amount,
    )


def release_payout(entry: PayoutLedgerEntry) -> PayoutLedgerEntry:
    entry.status = PayoutLedgerEntry.Status.RELEASED
    entry.save(update_fields=["status", "updated_at"])
    return entry


def get_frontend_app_url() -> str:
    explicit_url = os.getenv("FRONTEND_APP_URL", "").strip()
    if explicit_url:
        return explicit_url.rstrip("/")
    return "http://localhost:5173"


def configure_stripe() -> None:
    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if not secret_key:
        raise ValueError("Stripe is not configured. Add STRIPE_SECRET_KEY to the backend environment.")
    stripe.api_key = secret_key


def create_checkout_session(booking: Booking) -> stripe.checkout.Session:
    configure_stripe()
    frontend_url = get_frontend_app_url()
    item_name = booking.repair_request.item_name
    repairer_name = booking.repairer.shop_name or booking.repairer.user.email

    return stripe.checkout.Session.create(
        mode="payment",
        client_reference_id=str(booking.id),
        adaptive_pricing={"enabled": False},
        success_url=(
            f"{frontend_url}/client?payment=success&session_id={{CHECKOUT_SESSION_ID}}&booking_id={booking.id}"
        ),
        cancel_url=f"{frontend_url}/client?payment=cancelled&booking_id={booking.id}",
        metadata={
            "booking_id": str(booking.id),
            "repair_request_id": str(booking.repair_request_id),
            "customer_id": str(booking.repair_request.customer_id),
        },
        line_items=[
            {
                "quantity": 1,
                "price_data": {
                    "currency": "aud",
                    "unit_amount": int((booking.total_amount * 100).quantize(Decimal("1"))),
                    "product_data": {
                        "name": f"RepairHub payment - {item_name}",
                        "description": f"Repair service with {repairer_name}",
                    },
                },
            }
        ],
    )


def finalize_booking_payment(
    booking: Booking,
    *,
    stripe_payment_intent_id: str = "",
    payment_status: str = "paid",
) -> Booking:
    PaymentRecord.objects.update_or_create(
        booking=booking,
        defaults={
            "stripe_payment_intent_id": stripe_payment_intent_id,
            "amount": booking.total_amount,
            "currency": "AUD",
            "status": payment_status,
        },
    )

    if booking.payment_status == Booking.PaymentStatus.PAID:
        return booking

    booking.payment_status = Booking.PaymentStatus.PAID
    booking.save(update_fields=["payment_status", "updated_at"])

    if not booking.payout_entries.exists():
        create_payout_entry(booking)

    job = getattr(booking, "job", None)
    if job is not None:
        job.status = RepairRequest.Status.COMPLETED
        job.latest_update = "Customer payment received through Stripe. Repair marked as completed."
        job.save(update_fields=["status", "latest_update", "updated_at"])

    repair_request = booking.repair_request
    repair_request.status = RepairRequest.Status.COMPLETED
    repair_request.save(update_fields=["status", "updated_at"])
    return booking


def confirm_checkout_session_payment(booking: Booking, session_id: str) -> Booking:
    configure_stripe()
    session = stripe.checkout.Session.retrieve(session_id)

    if str(session.client_reference_id or "") != str(booking.id):
        raise ValueError("This Stripe payment session does not belong to the selected booking.")
    if session.payment_status != "paid":
        raise ValueError("Stripe has not marked this checkout session as paid yet.")

    payment_intent_id = session.payment_intent if isinstance(session.payment_intent, str) else ""
    return finalize_booking_payment(
        booking,
        stripe_payment_intent_id=payment_intent_id,
        payment_status=session.payment_status,
    )
