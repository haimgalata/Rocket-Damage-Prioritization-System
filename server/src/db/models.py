"""SQLAlchemy models for PrioritAI schema."""

from decimal import Decimal
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    settlement_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    organizations: Mapped[list["Organization"]] = relationship(back_populates="settlement")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    settlement_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("settlements.id", ondelete="RESTRICT"), nullable=False
    )
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    settlement: Mapped["Settlement"] = relationship(back_populates="organizations")
    users: Mapped[list["User"]] = relationship(back_populates="organization")
    events: Mapped[list["Event"]] = relationship(back_populates="organization")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    organization_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="SET NULL")
    )
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    role: Mapped["Role"] = relationship(back_populates="users")
    organization: Mapped["Organization | None"] = relationship(back_populates="users")
    events: Mapped[list["Event"]] = relationship(
        back_populates="created_by_user", foreign_keys="Event.created_by"
    )


class EventStatus(Base):
    __tablename__ = "event_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)

    events: Mapped[list["Event"]] = relationship(back_populates="status")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lat: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)
    lon: Mapped[Decimal] = mapped_column(Numeric(10, 7), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(128))
    name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False
    )
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("event_status.id", ondelete="RESTRICT"), nullable=False
    )
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    seed_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    organization: Mapped["Organization"] = relationship(back_populates="events")
    created_by_user: Mapped["User"] = relationship(
        back_populates="events", foreign_keys=[created_by]
    )
    status: Mapped["EventStatus"] = relationship(back_populates="events")
    images: Mapped[list["EventImage"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    gis: Mapped["EventGIS | None"] = relationship(
        back_populates="event", uselist=False, cascade="all, delete-orphan"
    )
    analysis: Mapped[list["EventAnalysis"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    tags: Mapped[list["EventTag"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class EventImage(Base):
    __tablename__ = "event_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)

    event: Mapped["Event"] = relationship(back_populates="images")


class EventGIS(Base):
    __tablename__ = "event_gis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    distance_hospital: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    distance_school: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    distance_road: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    distance_military: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    population_density: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    geo_multiplier: Mapped[Decimal] = mapped_column(Numeric(6, 3), default=Decimal("1.0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    event: Mapped["Event"] = relationship(back_populates="gis")


class EventAnalysis(Base):
    __tablename__ = "event_analysis"
    __table_args__ = (
        CheckConstraint(
            "damage_score >= 0 AND damage_score <= 10",
            name="event_analysis_damage_score_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    damage_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    damage_classification: Mapped[str] = mapped_column(String(32), nullable=False)
    priority_score: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    ai_model: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    event: Mapped["Event"] = relationship(back_populates="analysis")


class EventTag(Base):
    __tablename__ = "event_tags"
    __table_args__ = (UniqueConstraint("event_id", "tag", name="uq_event_tags_event_tag"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    tag: Mapped[str] = mapped_column(String(64), nullable=False)

    event: Mapped["Event"] = relationship(back_populates="tags")


class EventHistory(Base):
    __tablename__ = "event_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    old_status_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("event_status.id", ondelete="RESTRICT"), nullable=False
    )
    new_status_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("event_status.id", ondelete="RESTRICT"), nullable=False
    )
    changed_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
