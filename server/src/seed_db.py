"""Seed DB Script — PrioritAI.

1. Calls init_db() so the schema matches SQLAlchemy models (create_all).
2. Inserts reference data, settlements, organizations, users, and events from seed_events.json.

Run (e.g. in Docker): python -m server.src.seed_db

Idempotent: skips existing data to avoid duplicates (users by email/external_id, events by seed_key).
"""

import json
import logging
import os
from decimal import Decimal
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Ensure we load .env before DB connection
import dotenv
dotenv.load_dotenv()

from server.src.db.connection import get_db, init_db
from server.src.db.models import (
    Event,
    EventAnalysis,
    EventGIS,
    EventHistory,
    EventImage,
    EventStatus,
    EventTag,
    Organization,
    Role,
    Settlement,
    User,
)

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_JSON = _REPO_ROOT / "server" / "seed_events.json"

# (display name, unique settlement_code) — idempotent by name; orgs may use only a subset.
SEED_SETTLEMENTS: list[tuple[str, str]] = [
    ("Tel Aviv", "TAV-001"),
    ("South", "STH-002"),
    ("Jerusalem", "JRS-003"),
    ("Haifa", "HFA-004"),
    ("Herzliya", "HRZ-005"),
    ("Be'er Sheva", "BVS-006"),
    ("Netanya", "NTN-007"),
    ("Netivot", "NTV-008"),
    ("Kiryat Gat", "KTG-009"),
]


# ---------------------------------------------------------------------------
# Reference data (roles, event_status) — use existing, do NOT duplicate
# ---------------------------------------------------------------------------


def ensure_reference_data(db) -> None:
    """Ensure event_status and roles exist (add if missing)."""
    if db.query(EventStatus).count() == 0:
        for name in ("new", "in_progress", "done"):
            db.add(EventStatus(name=name))
        db.flush()
        logger.info("Seeded event_status.")
    if db.query(Role).count() == 0:
        for name in ("super_admin", "admin", "operator"):
            db.add(Role(name=name))
        db.flush()
        logger.info("Seeded roles.")


def seed_settlements(db) -> dict[str, int]:
    """Ensure seed settlements exist (by name). Returns mapping name -> id."""
    by_name = {s.name: s.id for s in db.query(Settlement).all()}
    added = 0
    for name, code in SEED_SETTLEMENTS:
        if name in by_name:
            continue
        db.add(Settlement(name=name, settlement_code=code))
        added += 1
    if added:
        db.flush()
        logger.info("Added %d new settlement(s); total seed list: %d.", added, len(SEED_SETTLEMENTS))
    else:
        logger.info("All %d seed settlements already present.", len(SEED_SETTLEMENTS))
    return {s.name: s.id for s in db.query(Settlement).all()}


def seed_organizations(db, settlement_ids: dict[str, int]) -> dict[str, int]:
    """Create organizations linked to settlements. Returns mapping external_id -> id."""
    result = {o.external_id: o.id for o in db.query(Organization).all() if o.external_id}
    if len(result) >= 3:
        logger.info("Organizations already exist — skipping.")
        return result

    orgs = [
        ("Tel Aviv Municipality", "Tel Aviv", "org-1"),
        ("South Authority", "South", "org-2"),
        ("Jerusalem Municipality", "Jerusalem", "org-3"),
    ]
    for name, settlement_name, ext_id in orgs:
        if ext_id in result:
            continue
        sid = settlement_ids.get(settlement_name)
        if not sid:
            logger.warning(f"Settlement '{settlement_name}' not found — skipping org {ext_id}")
            continue
        o = Organization(name=name, settlement_id=sid, external_id=ext_id)
        db.add(o)
        db.flush()
        result[ext_id] = o.id
    logger.info(f"Seeded organizations (total: {len(result)}).")
    return result


def reconcile_seed_users(db, org_ids: dict[str, int]) -> None:
    """Idempotent: two global super admins (null org); demote legacy third super admin."""
    role_sa = db.query(Role).filter(Role.name == "super_admin").first()
    role_admin = db.query(Role).filter(Role.name == "admin").first()
    if not role_sa or not role_admin:
        return
    org1 = org_ids.get("org-1")
    for email, ext in (
        ("haimgalata@gmail.com", "user-sa-haim"),
        ("linoysahalo@gmail.com", "user-sa-lino"),
    ):
        u = db.query(User).filter((User.email == email) | (User.external_id == ext)).first()
        if u:
            u.role_id = role_sa.id
            u.organization_id = None
            if u.external_id is None:
                u.external_id = ext
    legacy_sa = db.query(User).filter(
        (User.external_id == "user-sa-1") | (User.email == "sarah@prioritai.gov")
    ).first()
    if legacy_sa:
        legacy_sa.role_id = role_admin.id
        if org1:
            legacy_sa.organization_id = org1
    db.flush()


def seed_users(db, org_ids: dict[str, int]) -> dict[str, int]:
    """Create users: 2 super_admins (global), 6 org employees (1 admin + 1 operator per org).
    Passwords stored as plain text (1234). Reconciles roles/orgs on every run.
    Returns mapping external_id -> id.
    """
    role_sa = db.query(Role).filter(Role.name == "super_admin").first()
    role_admin = db.query(Role).filter(Role.name == "admin").first()
    role_op = db.query(Role).filter(Role.name == "operator").first()
    if not all([role_sa, role_admin, role_op]):
        raise RuntimeError("Roles not found — ensure_reference_data should have run after init_db().")

    existing = {u.external_id: u.id for u in db.query(User).all() if u.external_id}
    emails_exist = {u.email for u in db.query(User).all()}

    users_to_create = [
        ("Haim Galata", "haimgalata@gmail.com", "1234", role_sa.id, None, "user-sa-haim"),
        ("Linoy Sahalo", "linoysahalo@gmail.com", "1234", role_sa.id, None, "user-sa-lino"),
        ("David Levi", "david@tel-aviv.gov", "1234", role_admin.id, org_ids.get("org-1"), "user-admin-1"),
        ("Miriam Shapiro", "miriam@tel-aviv.gov", "1234", role_op.id, org_ids.get("org-1"), "user-op-1"),
        ("Ruth Goldstein", "ruth@south.gov", "1234", role_admin.id, org_ids.get("org-2"), "user-admin-2"),
        ("South Operator", "operator@south.gov", "1234", role_op.id, org_ids.get("org-2"), "user-op-south"),
        ("Eli Shapira", "eli@jerusalem.gov", "1234", role_admin.id, org_ids.get("org-3"), "user-admin-3"),
        ("Jerusalem Operator", "operator@jerusalem.gov", "1234", role_op.id, org_ids.get("org-3"), "user-op-jerusalem"),
    ]

    result = dict(existing)
    for name, email, password, role_id, org_id, ext_id in users_to_create:
        if ext_id in existing or email in emails_exist:
            continue
        u = User(
            name=name,
            email=email,
            password=password,
            role_id=role_id,
            organization_id=org_id,
            external_id=ext_id,
        )
        db.add(u)
        db.flush()
        result[ext_id] = u.id
        emails_exist.add(email)
        existing[ext_id] = u.id

    reconcile_seed_users(db, org_ids)

    ext_map = {u.external_id: u.id for u in db.query(User).all() if u.external_id}
    logger.info(f"Users with external_id: {len(ext_map)}.")
    return ext_map


def seed_events(db, org_ids: dict[str, int], user_ids: dict[str, int]) -> None:
    """Load seed_events.json and insert into events + event_images + event_analysis + event_gis + event_tags + event_history."""
    if not SEED_JSON.exists():
        logger.warning(f"seed_events.json not found at {SEED_JSON} — skipping events.")
        return

    with open(SEED_JSON, encoding="utf-8") as f:
        events_data = json.load(f)

    status_new = db.query(EventStatus).filter(EventStatus.name == "new").first()
    status_in_progress = db.query(EventStatus).filter(EventStatus.name == "in_progress").first()
    status_done = db.query(EventStatus).filter(EventStatus.name == "done").first()
    if not all([status_new, status_in_progress, status_done]):
        raise RuntimeError("Event statuses not found.")

    # Map seed status to DB status_id
    def status_id(s: str) -> int:
        s = (s or "").upper()
        if s == "COMPLETED" or s == "DONE":
            return status_done.id
        return status_in_progress.id

    created = 0
    skipped = 0
    for ev in events_data:
        org_ext = ev.get("organizationId", "org-1")
        user_ext = ev.get("createdBy", "user-op-1")
        org_db_id = org_ids.get(org_ext)
        user_db_id = user_ids.get(user_ext)
        if not org_db_id or not user_db_id:
            logger.warning(f"Skipping event: org={org_ext} or user={user_ext} not found.")
            continue

        loc = ev.get("location", {})
        lat = float(loc.get("lat", 0))
        lon = float(loc.get("lng", 0))
        address = loc.get("address") or ev.get("name") or ""
        city = loc.get("city") or "Israel"
        desc = ev.get("description", "No description")
        name = ev.get("name", "")
        curr_status_id = status_id(ev.get("status"))
        seed_key = ev.get("seedKey") or ev.get("seed_key")

        if seed_key:
            if db.query(Event).filter(Event.seed_key == seed_key).first():
                skipped += 1
                continue
            legacy = (
                db.query(Event)
                .filter(
                    Event.organization_id == org_db_id,
                    Event.description == desc,
                    Event.seed_key.is_(None),
                )
                .first()
            )
            if legacy:
                legacy.seed_key = seed_key
                # Backfill name if the legacy row is missing it
                if not legacy.name and name:
                    legacy.name = name
                db.flush()
                skipped += 1
                continue

        event = Event(
            lat=Decimal(str(lat)),
            lon=Decimal(str(lon)),
            address=address,
            city=city,
            name=name or None,
            description=desc,
            organization_id=org_db_id,
            created_by=user_db_id,
            status_id=curr_status_id,
            hidden=bool(ev.get("hidden", False)),
            seed_key=seed_key or None,
        )
        db.add(event)
        db.flush()

        # event_images
        img_url = ev.get("imageUrl") or f"/uploads/placeholder_{event.id}.jpg"
        db.add(EventImage(event_id=event.id, image_url=img_url))

        # event_analysis
        gis = ev.get("gisDetails", {})
        damage_score = float(ev.get("damageScore", 3))
        damage_class = ev.get("damageClassification", "Light")
        priority_score = float(ev.get("priorityScore", 5.0))
        explanation = ev.get("llmExplanation") or ""
        ai_model = ev.get("aiModel") or "PrioritAI-v2.1"
        db.add(
            EventAnalysis(
                event_id=event.id,
                damage_score=Decimal(str(damage_score)),
                damage_classification=damage_class,
                priority_score=Decimal(str(priority_score)),
                explanation=explanation or None,
                ai_model=ai_model,
            )
        )

        # event_gis
        dist_hosp = gis.get("distHospitalM")
        dist_school = gis.get("distSchoolM")
        dist_road = gis.get("distRoadM")
        dist_strategic = gis.get("distStrategicM")
        pop_dens = gis.get("populationDensity")
        geo_mult = gis.get("geoMultiplier", 1.0)
        if dist_hosp == -1:
            dist_hosp = None
        if dist_strategic == -1:
            dist_strategic = None
        db.add(
            EventGIS(
                event_id=event.id,
                distance_hospital=Decimal(str(dist_hosp)) if dist_hosp is not None else None,
                distance_school=Decimal(str(dist_school)) if dist_school is not None else None,
                distance_road=Decimal(str(dist_road)) if dist_road is not None else None,
                distance_military=Decimal(str(dist_strategic)) if dist_strategic is not None else None,
                population_density=Decimal(str(pop_dens)) if pop_dens is not None else None,
                geo_multiplier=Decimal(str(geo_mult)),
            )
        )

        # event_tags
        for tag in ev.get("tags") or []:
            t = (tag or "").strip()
            if t:
                db.add(EventTag(event_id=event.id, tag=t))

        # event_history: new -> current
        db.add(
            EventHistory(
                event_id=event.id,
                old_status_id=status_new.id,
                new_status_id=curr_status_id,
                changed_by=user_db_id,
            )
        )
        created += 1

    logger.info(
        f"Events seed: {created} inserted, {skipped} already present (seed_key / legacy match)."
    )


def run_seed() -> None:
    """Create schema (create_all), then seed idempotently."""
    logger.info("Initializing database (SQLAlchemy create_all)...")
    init_db()

    with get_db() as db:
        ensure_reference_data(db)

    with get_db() as db:
        settlement_ids = seed_settlements(db)

    with get_db() as db:
        org_ids = {o.external_id: o.id for o in db.query(Organization).filter(Organization.external_id.isnot(None)).all()}
        if not org_ids:
            settlement_map = {s.name: s.id for s in db.query(Settlement).all()}
            org_ids = seed_organizations(db, settlement_map)
        else:
            org_ids = {o.external_id: o.id for o in db.query(Organization).filter(Organization.external_id.isnot(None)).all()}

    with get_db() as db:
        user_ids = seed_users(db, org_ids)

    with get_db() as db:
        org_ids = {o.external_id: o.id for o in db.query(Organization).filter(Organization.external_id.isnot(None)).all()}
        user_ids = {u.external_id: u.id for u in db.query(User).filter(User.external_id.isnot(None)).all()}
        seed_events(db, org_ids, user_ids)

    logger.info("Seed complete. You can log in with haimgalata@gmail.com / 1234 or linoysahalo@gmail.com / 1234.")


if __name__ == "__main__":
    run_seed()
