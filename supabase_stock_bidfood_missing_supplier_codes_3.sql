-- ============================================================
-- R-Stock: fill in more Bidfood supplier codes flagged missing in the
-- Ordering page's Agent View
-- ============================================================
-- User-confirmed matches, looked up on the Bidfood portal. Follow-up
-- to supabase_stock_bidfood_missing_supplier_codes_2.sql.

UPDATE stock_item_sites sis
SET supplier_code = v.code, updated_at = NOW()
FROM stock_items si,
     (VALUES
        ('Diet Coke',        '221'),
        ('American Mustard', '21110'),
        ('Horseradish',      '29642')
     ) AS v(name, code)
WHERE sis.item_id = si.id
  AND si.name = v.name
  AND sis.supplier = 'Bidfood';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.name, sis.supplier, sis.supplier_code
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.name IN ('Diet Coke','American Mustard','Horseradish')
ORDER BY si.name;
