-- ============================================================
-- R-Stock: user-confirmed matches from the Bidfood master pricelist
-- ============================================================

UPDATE stock_items SET pack_size = 144, pack_cost = 52.20 WHERE sku = 'SKU-0062'; -- Wraps (Tortillas Flour 10", 12x12's carton)

UPDATE stock_items SET pack_size = 1000, pack_cost = 12.59
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Vegan Mayo'; -- Mayonnaise Plant Based Vegan

UPDATE stock_items SET pack_size = 2000, pack_cost = 26.63 WHERE sku = 'SKU-0041'; -- Flaky Salt, repriced to Salt Sea Flakes Blossoms (Olsson)
UPDATE stock_items SET pack_size = 2000, pack_cost = 24.85 WHERE sku = 'SKU-0127'; -- Choc Powder (Chococchino, Vittoria)
UPDATE stock_items SET pack_size = 16,   pack_cost = 47.16 WHERE sku = 'SKU-0180'; -- Paper Towel (Soft Choice, 16's carton)
UPDATE stock_items SET pack_size = 1,    pack_cost = 9.10  WHERE sku = 'SKU-0021'; -- Chux (Wipes Heavy Duty Roll, Perfect Pa)

-- Ignored per user: Wipes Antibacterial Heavy Duty (Marinucci)

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0062','SKU-0041','SKU-0127','SKU-0180','SKU-0021')
   OR name = 'Vegan Mayo'
ORDER BY name;
