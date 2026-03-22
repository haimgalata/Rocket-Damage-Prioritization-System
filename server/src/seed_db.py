"""Seed DB Script — PrioritAI.

Fully populates the database for end-to-end use:
- settlements, organizations, users (with real login credentials)
- events from seed_events.json (events, event_images, event_analysis, event_gis, event_tags, event_history)

Run migrations first, then: python -m server.src.seed_db

Idempotent: skips existing data to avoid duplicates.
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


# ---------------------------------------------------------------------------
# Reference data (roles, event_status) — use existing, do NOT duplicate
# ---------------------------------------------------------------------------


def ensure_reference_data(db) -> None:
    """Ensure event_status and roles exist. Migration already seeds them; add if missing."""
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
    """Create settlements if missing. Returns mapping name -> id."""
    result = {s.name: s.id for s in db.query(Settlement).all()}
    if len(result) >= 3:
        logger.info("Settlements already exist — skipping.")
        return result

    for name, code in [("Tel Aviv", "TAV-001"), ("South", "STH-002"), ("Jerusalem", "JRS-003")]:
        if name in result:
            continue
        s = Settlement(name=name, settlement_code=code)
        db.add(s)
    db.flush()
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


def seed_users(db, org_ids: dict[str, int]) -> dict[str, int]:
    """Create users: super_admins (haimgalata, linoysahalo), admins, operators.
    Passwords stored as plain text (1234 for super admins).
    Returns mapping external_id -> id.
    """
    role_sa = db.query(Role).filter(Role.name == "super_admin").first()
    role_admin = db.query(Role).filter(Role.name == "admin").first()
    role_op = db.query(Role).filter(Role.name == "operator").first()
    if not all([role_sa, role_admin, role_op]):
        raise RuntimeError("Roles not found — run migrations first.")

    existing = {u.external_id: u.id for u in db.query(User).all() if u.external_id}
    # Check by email for the two super admins we must create
    emails_exist = {u.email for u in db.query(User).all()}

    users_to_create = [
        # SUPER_ADMIN — required logins
        ("Haim Galata", "haimgalata@gmail.com", "1234", role_sa.id, org_ids.get("org-1"), "user-sa-haim"),
        ("Lino Ysahalo", "linoysahalo@gmail.com", "1234", role_sa.id, org_ids.get("org-1"), "user-sa-lino"),
        # Super admin (legacy) + org admins + operators
        ("Sarah Cohen", "sarah@prioritai.gov", "1234", role_sa.id, org_ids.get("org-1"), "user-sa-1"),
        ("David Levi", "david@tel-aviv.gov", "1234", role_admin.id, org_ids.get("org-1"), "user-admin-1"),
        ("Miriam Shapiro", "miriam@tel-aviv.gov", "1234", role_op.id, org_ids.get("org-1"), "user-op-1"),
        ("Yosef Mizrahi", "yosef@tel-aviv.gov", "1234", role_op.id, org_ids.get("org-1"), "user-op-2"),
        ("Ruth Goldstein", "ruth@south.gov", "1234", role_admin.id, org_ids.get("org-2"), "user-admin-2"),
        ("Eli Shapira", "eli@jerusalem.gov", "1234", role_admin.id, org_ids.get("org-3"), "user-admin-3"),
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

    logger.info(f"Seeded users (total with existing: {len(result)}).")
    return result


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

    # Check if we already have seeded events (by description + org match to avoid full re-seed)
    existing_count = db.query(Event).count()
    if existing_count >= len(events_data):
        logger.info("Events already seeded — skipping.")
        return

    created = 0
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

        event = Event(
            lat=Decimal(str(lat)),
            lon=Decimal(str(lon)),
            address=address,
            city=city,
            name=name,
            description=desc,
            organization_id=org_db_id,
            created_by=user_db_id,
            status_id=curr_status_id,
            hidden=bool(ev.get("hidden", False)),
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

    logger.info(f"Seeded {created} events (with images, analysis, GIS, tags, history).")


def run_seed() -> None:
    """Main entry: seed all data."""
    logger.info("Initializing database...")
    init_db()

    with get_db() as db:
        ensure_reference_data(db)

    with get_db() as db:
        settlement_ids = {s.name: s.id for s in db.query(Settlement).all()}
        if not settlement_ids:
            settlement_ids = seed_settlements(db)
        else:
            settlement_ids = {s.name: s.id for s in db.query(Settlement).all()}

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
