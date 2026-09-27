-- ============================================================
-- R-Stock: fill in Bidfood supplier codes flagged "MISSING SKU"
-- in the Ordering page's Agent View
-- ============================================================
-- User-confirmed matches, looked up on the Bidfood portal.

UPDATE stock_item_sites sis
SET supplier_code = v.code, updated_at = NOW()
FROM stock_items si,
     (VALUES
        ('Full Cream Milk',   '39689'),
        ('Skim Milk',         '39691'),
        ('Yoghurt',           '223692'),
        ('Maple Syrup',       '135772'),
        ('Passionfruit Pulp', '11831'),
        ('Pepitas',           '185998'),
        ('Vanilla Syrup',     '167296')
     ) AS v(name, code)
WHERE sis.item_id = si.id
  AND si.name = v.name
  AND sis.supplier = 'Bidfood';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.name, sis.supplier, sis.supplier_code
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.name IN ('Full Cream Milk','Skim Milk','Yoghurt','Maple Syrup','Passionfruit Pulp','Pepitas','Vanilla Syrup')
ORDER BY si.name;
