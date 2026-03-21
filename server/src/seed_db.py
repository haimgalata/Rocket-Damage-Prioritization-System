"""Seed DB Script — PrioritAI.

Creates settlements, organizations, and users for development.
Run migrations first, then: python -m server.src.seed_db
"""

import logging
import os

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
    EventStatus,
    Organization,
    Role,
    Settlement,
    User,
)


def run_seed() -> None:
    """Seed settlements, organizations, roles, users."""
    logger.info("Initializing database...")
    init_db()

    with get_db() as db:
        # Ensure event_status and roles exist
        if db.query(EventStatus).count() == 0:
            for name in ("new", "in_progress", "done"):
                db.add(EventStatus(name=name))
            logger.info("Seeded event_status.")
        if db.query(Role).count() == 0:
            for name in ("super_admin", "admin", "operator"):
                db.add(Role(name=name))
            logger.info("Seeded roles.")

    with get_db() as db:
        if db.query(Settlement).count() > 0:
            logger.info("Settlements already exist — skipping seed.")
            return

        role_sa = db.query(Role).filter(Role.name == "super_admin").first()
        role_admin = db.query(Role).filter(Role.name == "admin").first()
        role_op = db.query(Role).filter(Role.name == "operator").first()
        if not all([role_sa, role_admin, role_op]):
            logger.error("Roles not found — run app once to seed roles first.")
            return

        # Settlements
        s1 = Settlement(name="Tel Aviv", settlement_code="TAV-001")
        s2 = Settlement(name="South", settlement_code="STH-002")
        s3 = Settlement(name="Jerusalem", settlement_code="JRS-003")
        db.add_all([s1, s2, s3])
        db.flush()

        # Organizations
        o1 = Organization(
            name="Tel Aviv Municipality",
            settlement_id=s1.id,
            external_id="org-1",
        )
        o2 = Organization(
            name="South Authority",
            settlement_id=s2.id,
            external_id="org-2",
        )
        o3 = Organization(
            name="Jerusalem Municipality",
            settlement_id=s3.id,
            external_id="org-3",
        )
        db.add_all([o1, o2, o3])
        db.flush()

        # Users (matching mockData / seed_data external IDs)
        users = [
            User(
                name="Sarah Cohen",
                email="sarah@prioritai.gov",
                password="placeholder",  # Use proper hashing in production
                role_id=role_sa.id,
                organization_id=o1.id,
                external_id="user-sa-1",
            ),
            User(
                name="David Levi",
                email="david@tel-aviv.gov",
                password="placeholder",
                role_id=role_admin.id,
                organization_id=o1.id,
                external_id="user-admin-1",
            ),
            User(
                name="Miriam Shapiro",
                email="miriam@tel-aviv.gov",
                password="placeholder",
                role_id=role_op.id,
                organization_id=o1.id,
                external_id="user-op-1",
            ),
            User(
                name="Yosef Mizrahi",
                email="yosef@tel-aviv.gov",
                password="placeholder",
                role_id=role_op.id,
                organization_id=o1.id,
                external_id="user-op-2",
            ),
            User(
                name="Ruth Goldstein",
                email="ruth@south.gov",
                password="placeholder",
                role_id=role_admin.id,
                organization_id=o2.id,
                external_id="user-admin-2",
            ),
            User(
                name="Eli Shapira",
                email="eli@jerusalem.gov",
                password="placeholder",
                role_id=role_admin.id,
                organization_id=o3.id,
                external_id="user-admin-3",
            ),
        ]
        db.add_all(users)

    logger.info("Seeded 3 settlements, 3 organizations, 6 users.")


if __name__ == "__main__":
    run_seed()
