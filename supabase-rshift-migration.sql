-- ============================================================
-- R-Shift Multi-Tenant Schema Migration
-- Run this in the R-Shift Supabase project SQL editor
-- ============================================================

-- ── 1. ORGANISATIONS ────────────────────────────────────────

CREATE TABLE organisations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'Australia/Sydney',
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. ORG MEMBERS ──────────────────────────────────────────
-- Links auth users to organisations (supports future multi-user orgs)

CREATE TABLE org_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id  ON org_members(org_id);

-- ── 3. STAFF ────────────────────────────────────────────────

CREATE TABLE staff (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  hourly_rate      NUMERIC(10,2),
  weekend_rate     NUMERIC(10,2),
  employment_type  TEXT,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_org_id        ON staff(org_id);
CREATE INDEX idx_staff_org_active    ON staff(org_id, active);

-- ── 4. SCHEDULES ────────────────────────────────────────────

CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_key    TEXT NOT NULL,
  staff_id    UUID NOT NULL,
  time_slot   TEXT NOT NULL,
  role_id     TEXT,
  role_code   TEXT,
  role_color  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, date_key, staff_id, time_slot)
);

CREATE INDEX idx_schedules_org_id   ON schedules(org_id);
CREATE INDEX idx_schedules_date_key ON schedules(org_id, date_key);

-- ── 5. BUSINESS SETTINGS ────────────────────────────────────

CREATE TABLE business_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name         TEXT,
  logo_url              TEXT,
  operational_hours     JSONB,
  min_staff_coverage    INTEGER,
  peak_hours            JSONB,
  min_peak_staff_coverage INTEGER,
  currency              TEXT DEFAULT 'AUD',
  timezone              TEXT DEFAULT 'Australia/Sydney',
  updated_at            TIMESTAMPTZ,
  UNIQUE (org_id)
);

CREATE INDEX idx_business_settings_org_id ON business_settings(org_id);

-- ── 6. STAFF ORDER ──────────────────────────────────────────

CREATE TABLE staff_order (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_ids  JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ,
  UNIQUE (org_id)
);

CREATE INDEX idx_staff_order_org_id ON staff_order(org_id);

-- ── 7. SHIFT TEMPLATES ──────────────────────────────────────

CREATE TABLE shift_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role_id     TEXT,
  role_code   TEXT,
  role_color  TEXT,
  start_time  TEXT,
  end_time    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_templates_org_id ON shift_templates(org_id);

-- ── 8. DAILY REVENUE ────────────────────────────────────────

CREATE TABLE daily_revenue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  projected_revenue NUMERIC(12,2) DEFAULT 0,
  other_revenue     NUMERIC(12,2) DEFAULT 0,
  notes             TEXT,
  updated_at        TIMESTAMPTZ,
  UNIQUE (org_id, date)
);

CREATE INDEX idx_daily_revenue_org_id ON daily_revenue(org_id);
CREATE INDEX idx_daily_revenue_date   ON daily_revenue(org_id, date);

-- ── 9. STAFF AVAILABILITY ───────────────────────────────────

CREATE TABLE staff_availability (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  staff_id   UUID NOT NULL,
  date       DATE NOT NULL,
  status     TEXT NOT NULL,
  start_time TEXT,
  end_time   TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, date)
);

CREATE INDEX idx_staff_availability_org_id   ON staff_availability(org_id);
CREATE INDEX idx_staff_availability_staff_id ON staff_availability(staff_id);

-- ── 10. USER PROFILES ───────────────────────────────────────

CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ── 11. ROW LEVEL SECURITY ──────────────────────────────────
-- All access is gated: user must be a member of the org

ALTER TABLE organisations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff              ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_order        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_revenue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;

-- Helper: is this user a member of this org?
CREATE OR REPLACE FUNCTION is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- organisations: members can read their own org
CREATE POLICY "org_members_select" ON organisations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "org_members_insert" ON organisations
  FOR INSERT WITH CHECK (TRUE); -- any authed user can create an org (onboarding)

CREATE POLICY "org_members_update" ON organisations
  FOR UPDATE USING (is_org_member(id));

-- org_members: users can see their own memberships
CREATE POLICY "org_members_select" ON org_members
  FOR SELECT USING (user_id = auth.uid() OR is_org_member(org_id));

CREATE POLICY "org_members_insert" ON org_members
  FOR INSERT WITH CHECK (user_id = auth.uid()); -- can only add yourself

-- staff
CREATE POLICY "staff_all" ON staff
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- schedules
CREATE POLICY "schedules_all" ON schedules
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- business_settings
CREATE POLICY "business_settings_all" ON business_settings
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- staff_order
CREATE POLICY "staff_order_all" ON staff_order
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- shift_templates
CREATE POLICY "shift_templates_all" ON shift_templates
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- daily_revenue
CREATE POLICY "daily_revenue_all" ON daily_revenue
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- staff_availability
CREATE POLICY "staff_availability_all" ON staff_availability
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

-- user_profiles
CREATE POLICY "user_profiles_all" ON user_profiles
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
