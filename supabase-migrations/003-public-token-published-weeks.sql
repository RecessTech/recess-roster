-- Add public_token to staff for shareable schedule links
ALTER TABLE staff ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
UPDATE staff SET public_token = gen_random_uuid() WHERE public_token IS NULL;
ALTER TABLE staff ALTER COLUMN public_token SET NOT NULL;

-- Published weeks: tracks which roster weeks have been finalised
CREATE TABLE IF NOT EXISTS published_weeks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  published_by UUID REFERENCES auth.users(id),
  UNIQUE(org_id, week_start)
);

ALTER TABLE published_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage published weeks"
  ON published_weeks FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
