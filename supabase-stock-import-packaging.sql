-- ============================================================
-- R-Stock: Import the packaging list as SKUs (category PCK)
-- Run this after supabase-stock-migration-7.sql and
-- supabase-stock-categorize-existing.sql.
-- ============================================================
-- Per your answers:
--  - Napkins / Cling Wrap / Bin Bags already existed in the catalog
--    under a generic name -- merged in place rather than duplicated
--    (statement 2 below), and their category is set to PCK.
--  - The generic "Gloves" item is retired (deleted) in favour of the
--    new "Gloves (Large)" / "Gloves (Medium)" items (statement 1).
--    This also removes any order-history rows for that item (cascade)
--    -- fine since it's a fresh app with no real order history yet.
--  - Supplier is left NULL for every packaging item -- name wasn't
--    given yet. Fill it in via the Items tab (or re-run this file's
--    logic) once you have it.
--  - units_per_carton is only populated where the source description
--    stated an explicit carton count (5 of 33 items). Everything else
--    is NULL -- backfill via the Items tab as you confirm counts.
--  - Every item is assigned to BOTH Crown St and Bourke St.

-- ── 1. Retire the generic "Gloves" item ─────────────────────
DELETE FROM stock_items
WHERE name = 'Gloves'
  AND org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  );

-- ── 2. Merge collisions into existing catalog rows ──────────
UPDATE stock_items si
SET category = 'PCK', updated_at = NOW(),
    description = v.description
FROM (VALUES
  ('Napkins',    'WHITE COCKTAIL NAPKIN 2 PLY - ENVIROWARE'),
  ('Cling Wrap', '45CM X 600MTR CLING WRAP W/-DISPENSER'),
  ('Bin Bags',   '120LTR HEAVY DUTY BIN LINER')
) AS v(name, description)
WHERE si.name = v.name
  AND si.org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  );

-- ── 3. Insert the remaining 30 new packaging items ──────────
WITH org AS (
  SELECT om.org_id FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
),
next_start AS (
  SELECT COALESCE(MAX(SUBSTRING(sku FROM 5)::int), 0) AS max_num
  FROM stock_items, org WHERE stock_items.org_id = org.org_id
),
new_items(name, description, units_per_carton) AS (
  VALUES
    ('8oz Coffee Lid',           '8OZ WHITE TRAVEL LID - PINNACLE',                                              NULL::numeric),
    ('Catering Tray 3 (Base)',   'CATERING TRAY 3 BROWN KRAFT (558X252X80MM)',                                   NULL),
    ('Catering Tray 3 (Lid)',    'CATERING TRAY 3 LID WITH WINDOW (562X255X30MM)',                               NULL),
    ('Boats',                    'OPEN TRAY #1 BROWN KRAFT (133X95X50MM)',                                       NULL),
    ('Iced Cups',                'ENVIROWARE 14OZ RPET CLEAR CUP',                                               NULL),
    ('Iced Lids',                'F98 FLAT PET SIPPER LID - TO SUIT 14/16/20/24 ENVIROWARE CUP',                 NULL),
    ('Carry Bags',               'KRAFT PAPER TWIST HANDLE BAG (305 X 305 X 175MM)',                             NULL),
    ('Salad Bowl (Kraft)',       '1300ML SUPA BOWL - KRAFT',                                                     NULL),
    ('Salad Lid',                'LARGE LID FOR SUPA BOWL 1300ML - PET',                                         NULL),
    ('Paper Towel',              'ULTRASLIM HAND TOWEL 23X24CM (16X150 SHEETS) 2266 - ESSENTIALS (IE-HTU2)',     NULL),
    ('Soup Container w/ Lids',   'KRAFT 16OZ SOUP/FOOD CONTAINER & LID COMBO',                                   NULL),
    ('Sandwich Tubs',            '1000ML KRAFT PAPERWAY CONTAINER',                                              NULL),
    ('Sandwich Lids',            'CLEAR PET LID TO SUIT PAPERWAY PRC500-1000',                                   NULL),
    ('Straws',                   'KRAFT REGULAR PAPER STRAWS (6X200MM)',                                         NULL),
    ('Small Coffee Cups (6oz)',  '6OZ WHITE SINGLE WALL TRULY ECO CUP (PLASTIC-FREE) - 80MM DIA',                NULL),
    ('Medium Coffee Cups (8oz)', '8OZ WHITE SINGLE WALL TRULY ECO CUP (PLASTIC-FREE)',                           NULL),
    ('Large Coffee Cups (10oz)', '10OZ WHITE SINGLE WALL TRULY ECO CUP (PLASTIC-FREE) - 80MM DIA',               NULL),
    ('Gloves (Large)',           'POWDER FREE CLEAR LARGE VINYL GLOVES - VITALS',                                NULL),
    ('Wooden Spoons',            'WOODEN TEASPOON (5000/CTN)',                                                   5000),
    ('Salad Bowl (White)',       '1300ML SUPA BOWL - WHITE',                                                     NULL),
    ('Gloves (Medium)',          'POWDER FREE CLEAR MEDIUM VINYL GLOVES - VITALS',                               NULL),
    ('Catering Tray 1 (Base)',   NULL,                                                                            NULL),
    ('Catering Tray 1 (Lid)',    NULL,                                                                            NULL),
    ('Catering Tray 2 (Base)',   NULL,                                                                            NULL),
    ('Catering Tray 2 (Lid)',    NULL,                                                                            NULL),
    ('Catering Tray 4 (Base)',   NULL,                                                                            NULL),
    ('Catering Tray 4 (Lid)',    NULL,                                                                            NULL),
    ('Equals',                   'EQUAL PENCIL STICKS - 500/CTN',                                                500),
    ('Wooden Fork',              'WOODEN FORK (2000/CTN)',                                                       2000),
    ('Greaseproof Paper',        'INDO GREASEPROOF PAPER 30GSM - CUT IN 2 (400 X 330 MM) 800 SHTS/REAM',         800)
),
numbered AS (
  SELECT *, ROW_NUMBER() OVER () AS rn FROM new_items
)
INSERT INTO stock_items (org_id, name, category, description, units_per_carton, uom, sku)
SELECT org.org_id, numbered.name, 'PCK', numbered.description, numbered.units_per_carton, 'units',
       'SKU-' || LPAD((next_start.max_num + numbered.rn)::text, 4, '0')
FROM numbered, org, next_start;

-- ── 4. Assign all 33 packaging items to both sites ──────────
-- Adds the supplier's product code to each site assignment; creates
-- the assignment if it doesn't exist yet, or just adds the code onto
-- an existing one without touching its supplier/qty/status.
WITH org AS (
  SELECT om.org_id FROM org_members om
  JOIN auth.users u ON u.id = om.user_id
  WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
),
codes(name, product_code) AS (
  VALUES
    ('Greaseproof Paper',        '28CH2'),
    ('8oz Coffee Lid',           '8TLWPP'),
    ('Cling Wrap',               'CW45'),
    ('Catering Tray 3 (Base)',   'ECT3'),
    ('Catering Tray 3 (Lid)',    'ECT3L'),
    ('Boats',                    'EOT1B'),
    ('Iced Cups',                'EW14RPET'),
    ('Iced Lids',                'EW16SL'),
    ('Carry Bags',               'EWTHBMED'),
    ('Salad Bowl (Kraft)',       'FC1300K'),
    ('Salad Lid',                'FCLIDL'),
    ('Paper Towel',              'HTU'),
    ('Soup Container w/ Lids',   'KSC16COMBO'),
    ('Napkins',                  'N2PLYCW'),
    ('Sandwich Tubs',            'PRC1000K'),
    ('Sandwich Lids',            'PRCLIDPET'),
    ('Straws',                   'STRAWPKR'),
    ('Small Coffee Cups (6oz)',  'SWPF06W'),
    ('Medium Coffee Cups (8oz)', 'SWPF08W'),
    ('Large Coffee Cups (10oz)', 'SWPF10W'),
    ('Gloves (Large)',           'VGLPFMC'),
    ('Wooden Spoons',            'WTS'),
    ('Salad Bowl (White)',       'FC1300W'),
    ('Bin Bags',                 'GBL120R'),
    ('Gloves (Medium)',          'VGMPFMC'),
    ('Catering Tray 1 (Base)',   'ECT1'),
    ('Catering Tray 1 (Lid)',    'ECT1L'),
    ('Catering Tray 2 (Base)',   'ECT2'),
    ('Catering Tray 2 (Lid)',    'ECT2L'),
    ('Catering Tray 4 (Base)',   'ECT4'),
    ('Catering Tray 4 (Lid)',    'ECT4L'),
    ('Equals',                   'EQUALS'),
    ('Wooden Fork',              'WF')
)
INSERT INTO stock_item_sites (org_id, item_id, location_id, supplier_code, reference_order_qty)
SELECT org.org_id, si.id, loc.id, codes.product_code, 0
FROM codes
JOIN stock_items si ON si.name = codes.name AND si.org_id = (SELECT org_id FROM org)
JOIN locations loc ON loc.org_id = (SELECT org_id FROM org) AND loc.name IN ('Crown St', 'Bourke St')
CROSS JOIN org
ON CONFLICT (item_id, location_id) DO UPDATE
  SET supplier_code = EXCLUDED.supplier_code, updated_at = NOW();

-- Verify: every packaging item, both sites, with its code
SELECT si.name, si.sku, si.units_per_carton, loc.name AS site, sis.supplier_code
FROM stock_item_sites sis
JOIN stock_items si ON si.id = sis.item_id
JOIN locations loc ON loc.id = sis.location_id
WHERE si.category = 'PCK'
  AND si.org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  )
ORDER BY si.name, loc.name;
