-- Creates the "Slim" sku_groups list (an expanded version of "Bus Stop")
-- for org 788c4cea-50dd-4284-a218-3a971c8b510d ("It's Recess"), and
-- populates it with the 54 SKUs the user selected via a scoping sheet.
--
-- This is a data-only change (no schema change) -- applied live via
-- execute_sql against project agiobncbephcgmarsjeu, recorded here for
-- documentation/reproducibility.

WITH new_group AS (
  INSERT INTO sku_groups (org_id, name, sort_order)
  VALUES ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Slim',
    (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM sku_groups WHERE org_id = '788c4cea-50dd-4284-a218-3a971c8b510d'))
  RETURNING id
),
codes AS (
  SELECT * FROM (VALUES
    ('SKU-0102'),('SKU-0101'),('SKU-0096'),('SKU-0098'),('SKU-0099'),('SKU-0097'),
    ('SKU-0011'),('SKU-0046'),('SKU-0039'),('SKU-0063'),('SKU-0034'),('SKU-0006'),
    ('SKU-0041'),('SKU-0033'),('SKU-0013'),('SKU-0004'),('SKU-0047'),('SKU-0035'),
    ('SKU-0040'),('SKU-0003'),('SKU-0001'),('SKU-0036'),('SKU-0007'),('SKU-0012'),
    ('SKU-0042'),('SKU-0052'),('SKU-0002'),('SKU-0009'),('SKU-0048'),('SKU-0043'),
    ('SKU-0044'),('SKU-0062'),('SKU-0104'),('SKU-0069'),('SKU-0077'),('SKU-0085'),
    ('SKU-0073'),('SKU-0071'),('SKU-0080'),('SKU-0072'),('SKU-0081'),('SKU-0076'),
    ('SKU-0084'),('SKU-0079'),('SKU-0088'),('SKU-0070'),('SKU-0074'),('SKU-0092'),
    ('SKU-0090'),('SKU-0091'),('SKU-0093'),('SKU-0094'),('SKU-0050'),('SKU-0095')
  ) AS t(code)
)
INSERT INTO sku_group_items (group_id, item_id, sort_order)
SELECT (SELECT id FROM new_group), si.id, row_number() OVER (ORDER BY codes.code) - 1
FROM codes
JOIN stock_items si ON si.sku = codes.code AND si.org_id = '788c4cea-50dd-4284-a218-3a971c8b510d'
RETURNING item_id;
