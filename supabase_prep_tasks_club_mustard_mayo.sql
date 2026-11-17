-- Adds "Club Mayo" and "Mustard Mayo" to the Prep List catalog for
-- org 788c4cea-50dd-4284-a218-3a971c8b510d ("It's Recess"). Data-only
-- change applied live via execute_sql, recorded here for reproducibility.

WITH maxrow AS (
  SELECT COALESCE(MAX(sort_order), -1) AS m FROM prep_tasks WHERE org_id = '788c4cea-50dd-4284-a218-3a971c8b510d'
)
INSERT INTO prep_tasks (org_id, name, sort_order)
SELECT '788c4cea-50dd-4284-a218-3a971c8b510d', name, maxrow.m + row_number() OVER ()
FROM maxrow, (VALUES ('Club Mayo'), ('Mustard Mayo')) AS t(name)
RETURNING id, name, sort_order;
