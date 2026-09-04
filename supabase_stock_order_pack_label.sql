-- ============================================================
-- Order-by-pack support: Stocktake/Ordering/Transfers can now show
-- and edit a pack count ("2 trays") instead of a raw weight for
-- items bought as a whole tray/box, while R-Recipe, Crystal Ball,
-- and order history keep reading the exact same underlying gram/ml
-- value they always have -- pack_size is already "grams in one
-- tray/box" (fixed in an earlier pass), so the pack count is simply
-- qty / pack_size. No other data changes.
--
-- Editable going forward from R-Stock's Items tab ("Ordered By"
-- field) -- this migration just seeds the 4 known SKUs.
-- ============================================================

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS order_pack_label TEXT;

UPDATE stock_items SET order_pack_label = 'box', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0077'; -- Baby Cos Gem

UPDATE stock_items SET order_pack_label = 'tray', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0071'; -- Cherry Toms

UPDATE stock_items SET order_pack_label = 'box', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0096'; -- Eggs

UPDATE stock_items SET order_pack_label = 'tray', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0069'; -- Avos

-- ── VERIFY ─────────────────────────────────────────────────────
-- order_qty_in_packs should read as a clean-ish number of trays/boxes
-- given the live reference_order_qty set earlier in this series.
SELECT si.sku, si.name, si.uom, si.pack_size, si.order_pack_label,
       sis.reference_order_qty,
       round((sis.reference_order_qty / si.pack_size)::numeric, 2) AS order_qty_in_packs
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0077', 'SKU-0071', 'SKU-0096', 'SKU-0069')
ORDER BY si.sku;
