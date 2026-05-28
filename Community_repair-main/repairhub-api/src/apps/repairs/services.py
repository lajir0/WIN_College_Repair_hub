from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from math import asin, cos, radians, sin, sqrt

from django.conf import settings
from django.contrib.auth import get_user_model

from apps.catalog.models import PricingRule, RepairerService
from apps.repairers.models import RepairerProfile
from apps.repairs.models import RepairAnalysis, RepairJob, RepairMatch, RepairRequest

User = get_user_model()
TWO_PLACES = Decimal("0.01")


DEMO_MARKETPLACE = {}


def haversine_distance_km(lat1: Decimal, lon1: Decimal, lat2: Decimal, lon2: Decimal) -> Decimal:
    radius = 6371
    lat1_value = Decimal(str(lat1))
    lon1_value = Decimal(str(lon1))
    lat2_value = Decimal(str(lat2))
    lon2_value = Decimal(str(lon2))
    dlat = radians(float(lat2_value - lat1_value))
    dlon = radians(float(lon2_value - lon1_value))
    lat1_rad = radians(float(lat1_value))
    lat2_rad = radians(float(lat2_value))
    area = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    value = 2 * radius * asin(sqrt(area))
    return Decimal(str(round(value, 2)))


def quantize_decimal(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def quote_base_from_request(request: RepairRequest, service: RepairerService) -> Decimal:
    estimated_min = Decimal(str(request.estimated_min_cost or 0))
    estimated_max = Decimal(str(request.estimated_max_cost or 0))
    if estimated_min > 0 and estimated_max > 0 and estimated_max >= estimated_min:
        return (estimated_min + estimated_max) / 2
    return (service.min_price + service.max_price) / 2


def estimate_quote(service: RepairerService, request: RepairRequest) -> Decimal:
    base = quote_base_from_request(request, service)
    rule = (
        PricingRule.objects.filter(service=service, urgency=request.urgency)
        .order_by("-created_at")
        .first()
    )
    if not rule:
        return quantize_decimal(base)
    return quantize_decimal((base * rule.multiplier) + rule.flat_fee)


def calculate_match_score(distance: Decimal, rating: Decimal, quote: Decimal) -> Decimal:
    distance_score = max(Decimal("0"), Decimal("100") - distance)
    rating_score = rating * Decimal("10")
    quote_score = max(Decimal("0"), Decimal("20") - (quote / Decimal("10")))
    return quantize_decimal(distance_score + rating_score + quote_score)


def ensure_demo_marketplace_data(repair_request: RepairRequest) -> None:
    if not settings.DEBUG or repair_request.category is None:
        return

    category_slug = repair_request.category.slug
    if category_slug not in DEMO_MARKETPLACE:
        return

    for spec in DEMO_MARKETPLACE[category_slug]:
        user, _ = User.objects.get_or_create(
            email=spec["email"],
            defaults={
                "username": spec["email"],
                "first_name": spec["first_name"],
                "last_name": spec["last_name"],
                "role": User.Role.REPAIRER,
                "profile_status": User.ProfileStatus.ACTIVE,
            },
        )
        if not user.has_usable_password():
            user.set_password("repairhub-demo-123")
            user.save(update_fields=["password"])

        profile, _ = RepairerProfile.objects.update_or_create(
            user=user,
            defaults={
                "headline": spec["headline"],
                "city": spec["city"],
                "shop_name": spec["shop_name"],
                "shop_address": spec["shop_address"],
                "shop_phone": spec["shop_phone"],
                "shop_opening_hours": spec["shop_opening_hours"],
                "service_radius_km": Decimal("18.0"),
                "rating": spec["rating"],
                "reviews_count": spec["reviews_count"],
                "latitude": spec["latitude"],
                "longitude": spec["longitude"],
                "verification_status": RepairerProfile.VerificationStatus.VERIFIED,
                "is_online": True,
            },
        )
        service, _ = RepairerService.objects.update_or_create(
            repairer=profile,
            category=repair_request.category,
            title=spec["service_title"],
            defaults={
                "description": spec["service_description"],
                "min_price": spec["min_price"],
                "max_price": spec["max_price"],
                "warranty_days": spec["warranty_days"],
                "turnaround_hours": spec["turnaround_hours"],
                "is_active": True,
            },
        )
        for urgency, multiplier, flat_fee in [
            (RepairRequest.Urgency.STANDARD, Decimal("1.00"), Decimal("5.00")),
            (RepairRequest.Urgency.URGENT, Decimal("1.18"), Decimal("12.00")),
            (RepairRequest.Urgency.FLEXIBLE, Decimal("0.95"), Decimal("0.00")),
        ]:
            PricingRule.objects.update_or_create(
                service=service,
                damage_band="general",
                urgency=urgency,
                defaults={
                    "multiplier": multiplier,
                    "flat_fee": flat_fee,
                },
            )


def build_matches(repair_request: RepairRequest) -> list[RepairMatch]:
    if repair_request.category is None:
        return []

    services = RepairerService.objects.select_related("repairer").filter(
        category=repair_request.category,
        is_active=True,
        repairer__verification_status="verified",
        repairer__is_online=True,
    )
    RepairMatch.objects.filter(repair_request=repair_request).delete()

    matches_to_create: list[RepairMatch] = []
    for service in services:
        distance = haversine_distance_km(
            repair_request.latitude,
            repair_request.longitude,
            service.repairer.latitude,
            service.repairer.longitude,
        )
        if distance > service.repairer.service_radius_km:
            continue
        quote = estimate_quote(service, repair_request)
        score = calculate_match_score(
            distance=distance,
            rating=service.repairer.rating,
            quote=quote,
        )
        matches_to_create.append(
            RepairMatch(
                repair_request=repair_request,
                repairer=service.repairer,
                service=service,
                distance_km=distance,
                quote_amount=quote,
                eta_hours=service.turnaround_hours,
                score=score,
                ranking_reason="Ranked by distance, rating, and pricing rules",
                selected=bool(
                    repair_request.selected_repairer_id == service.repairer_id
                    and repair_request.selected_service_id == service.id
                ),
            )
        )

    if matches_to_create:
        RepairMatch.objects.bulk_create(matches_to_create)

    matches = list(
        RepairMatch.objects.select_related("repairer__user", "service")
        .filter(repair_request=repair_request)
        .order_by("-score", "distance_km", "quote_amount")
    )
    repair_request.status = (
        RepairRequest.Status.MATCHED if matches else RepairRequest.Status.MATCHING
    )
    repair_request.save(update_fields=["status", "updated_at"])
    return matches


def attach_analysis(
    repair_request: RepairRequest, analysis_data: dict[str, object]
) -> RepairAnalysis:
    analysis, _ = RepairAnalysis.objects.update_or_create(
        repair_request=repair_request,
        defaults={
            "damage_type": str(analysis_data["damage_type"]),
            "severity": str(analysis_data["severity"]),
            "confidence": Decimal(str(analysis_data["confidence"])),
            "summary": str(analysis_data["summary"]),
            "replace_cost": Decimal(str(analysis_data["replace_cost"])),
            "waste_saved_kg": Decimal(str(analysis_data["waste_saved_kg"])),
            "raw_payload": dict(analysis_data),
        },
    )
    repair_request.status = RepairRequest.Status.ANALYZED
    repair_request.estimated_min_cost = Decimal(str(analysis_data["estimated_min_cost"]))
    repair_request.estimated_max_cost = Decimal(str(analysis_data["estimated_max_cost"]))
    repair_request.estimated_hours = int(analysis_data["estimated_hours"])
    repair_request.save(
        update_fields=[
            "status",
            "estimated_min_cost",
            "estimated_max_cost",
            "estimated_hours",
            "updated_at",
        ]
    )
    return analysis


def transition_job(job: RepairJob, new_status: str, latest_update: str) -> RepairJob:
    job.status = new_status
    job.latest_update = latest_update
    job.save(update_fields=["status", "latest_update", "updated_at"])
    return job
