-- =============================================================================
-- PrioritAI — Initial PostgreSQL Schema
-- Run order: tables first, then indexes, then seed data
-- =============================================================================

-- 1. Reference/Lookup Tables (no FKs)
CREATE TABLE settlements (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL UNIQUE,
    settlement_code VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE roles (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE
);

CREATE TABLE event_status (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(32) NOT NULL UNIQUE
);

-- 2. Organizations (depends on settlements)
-- external_id: legacy lookup for migration (e.g. "org-1") until auth is implemented
CREATE TABLE organizations (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL UNIQUE,
    settlement_id INTEGER NOT NULL REFERENCES settlements(id) ON DELETE RESTRICT,
    external_id   VARCHAR(64) UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_settlement ON organizations(settlement_id);

-- 3. Users (depends on roles, organizations)
-- external_id: legacy lookup for migration (e.g. "user-op-1") until auth is implemented
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    external_id     VARCHAR(64) UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_organization ON users(organization_id);

-- 4. Events (depends on organizations, users, event_status)
CREATE TABLE events (
    id              SERIAL PRIMARY KEY,
    lat             NUMERIC(10, 7) NOT NULL,
    lon             NUMERIC(10, 7) NOT NULL,
    address         VARCHAR(500),
    city            VARCHAR(128),
    name            VARCHAR(255),
    description     TEXT NOT NULL,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    created_by      INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status_id       INTEGER NOT NULL REFERENCES event_status(id) ON DELETE RESTRICT,
    hidden          BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_organization ON events(organization_id);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_status ON events(status_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- 5. EventImages
CREATE TABLE event_images (
    id        SERIAL PRIMARY KEY,
    event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL
);

CREATE INDEX idx_event_images_event ON event_images(event_id);

-- 6. EventGIS (1:1 with event)
CREATE TABLE event_gis (
    id                 SERIAL PRIMARY KEY,
    event_id           INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    distance_hospital  NUMERIC(12, 2),
    distance_school    NUMERIC(12, 2),
    distance_road      NUMERIC(12, 2),
    distance_military  NUMERIC(12, 2),
    population_density NUMERIC(12, 2),
    geo_multiplier     NUMERIC(6, 3) DEFAULT 1.0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_gis_event ON event_gis(event_id);

-- 7. EventAnalysis (latest analysis per event — 1:1 for simplicity; can version later)
-- explanation: AI-generated text (e.g. Groq, OpenAI, other LLM). Generate from damage_score,
-- priority_score, and GIS features (distances, population_density, geo_multiplier).
-- Example template: "{classification} damage. Nearest hospital {dist}m, density {n}/km².
-- Multiplier ×{m}. Final: {priority}/10."
CREATE TABLE event_analysis (
    id                    SERIAL PRIMARY KEY,
    event_id              INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    damage_score          NUMERIC(5, 2) NOT NULL CHECK (damage_score >= 0 AND damage_score <= 10),
    damage_classification VARCHAR(32) NOT NULL,
    priority_score        NUMERIC(8, 2) NOT NULL,
    explanation           TEXT,
    ai_model              VARCHAR(64),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_analysis_event ON event_analysis(event_id);

-- 8. EventTags
CREATE TABLE event_tags (
    id       SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag      VARCHAR(64) NOT NULL,
    UNIQUE(event_id, tag)
);

CREATE INDEX idx_event_tags_event ON event_tags(event_id);

-- 9. EventHistory
CREATE TABLE event_history (
    id             SERIAL PRIMARY KEY,
    event_id       INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    old_status_id  INTEGER NOT NULL REFERENCES event_status(id) ON DELETE RESTRICT,
    new_status_id  INTEGER NOT NULL REFERENCES event_status(id) ON DELETE RESTRICT,
    changed_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_history_event ON event_history(event_id);

-- 10. Seed reference data
INSERT INTO event_status (name) VALUES ('new'), ('in_progress'), ('done');
INSERT INTO roles (name) VALUES ('super_admin'), ('admin'), ('operator');
