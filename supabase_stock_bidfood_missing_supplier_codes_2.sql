-- ============================================================
-- R-Stock: fill in more Bidfood supplier codes flagged "MISSING SKU"
-- in the Ordering page's Agent View
-- ============================================================
-- User-confirmed matches, looked up on the Bidfood portal. Follow-up
-- to supabase_stock_bidfood_missing_supplier_codes.sql.

UPDATE stock_item_sites sis
SET supplier_code = v.code, updated_at = NOW()
FROM stock_items si,
     (VALUES
        ('Banana Puree',             '140866'),
        ('Strawberry Puree',         '140874'),
        ('Olive Oil - Extra Virgin', '221604')
     ) AS v(name, code)
WHERE sis.item_id = si.id
  AND si.name = v.name
  AND sis.supplier = 'Bidfood';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.name, sis.supplier, sis.supplier_code
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.name IN ('Banana Puree','Strawberry Puree','Olive Oil - Extra Virgin')
ORDER BY si.name;
