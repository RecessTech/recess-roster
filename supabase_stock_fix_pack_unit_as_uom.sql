-- ============================================================
-- Fixes a batch of PHF/produce SKUs where `uom` was set to the
-- PURCHASE PACK ("tins", "box", "bunch", "punnet", "units") instead of
-- grams -- while pack_size already correctly holds grams-per-pack, and
-- every recipe line referencing these SKUs was already written in
-- grams. Net effect of the bug: recipe expansion (Crystal Ball prep
-- lists, R-Recipe costing) read those gram quantities as if they were
-- whole-pack counts, producing e.g. "2880 tins of tuna in one batch".
--
-- The fix is a relabel, not a rescale: pack_size stays the same number
-- (it already meant "grams in one tin/box/bunch/punnet"), uom becomes
-- 'g', and the purchase-pack unit moves to order_pack_label (same
-- mechanism as Baby Cos Gem/Cherry Toms/Eggs/Avos from the earlier
-- tray-fix pass) so Stocktake/Ordering can still show "X tins" etc.
-- reference_order_qty / order_qty / order history, which WERE entered
-- in pack-count terms, get scaled by pack_size to convert them to grams.
--
-- Each scaling UPDATE is guarded on the item's CURRENT (pre-fix) uom,
-- so this script is safe to run only once -- a second run matches zero
-- rows and no-ops.
-- ============================================================

-- ── Tuna (SKU-0050): tins -> g, 425g per tin ──────────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0050' AND si.uom = 'tins';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0050' AND si.uom = 'tins';

UPDATE stock_items SET uom = 'g', order_pack_label = 'tin', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0050' AND uom = 'tins';

-- ── Rocket (SKU-0079): box -> g, 1500g per box ────────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0079' AND si.uom = 'box';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0079' AND si.uom = 'box';

UPDATE stock_items SET uom = 'g', order_pack_label = 'box', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0079' AND uom = 'box';

-- ── Strawberries (SKU-0089): punnet -> g, 250g per punnet ─────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0089' AND si.uom = 'punnet';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0089' AND si.uom = 'punnet';

UPDATE stock_items SET uom = 'g', order_pack_label = 'punnet', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0089' AND uom = 'punnet';

-- ── Celery (SKU-0073): units -> g, 400g per bunch ─────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0073' AND si.uom = 'units';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0073' AND si.uom = 'units';

UPDATE stock_items SET uom = 'g', order_pack_label = 'bunch', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0073' AND uom = 'units';

-- ── Chives (SKU-0080): bunch -> g, 125g per bunch ─────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0080' AND si.uom = 'bunch';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0080' AND si.uom = 'bunch';

UPDATE stock_items SET uom = 'g', order_pack_label = 'bunch', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0080' AND uom = 'bunch';

-- ── Dill (SKU-0081): bunch -> g, 125g per bunch ───────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0081' AND si.uom = 'bunch';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0081' AND si.uom = 'bunch';

UPDATE stock_items SET uom = 'g', order_pack_label = 'bunch', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0081' AND uom = 'bunch';

-- ── Kale (SKU-0076): bunch -> g, 300g per bunch ───────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0076' AND si.uom = 'bunch';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0076' AND si.uom = 'bunch';

UPDATE stock_items SET uom = 'g', order_pack_label = 'bunch', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0076' AND uom = 'bunch';

-- ── Thyme (SKU-0086): bunch -> g, 30g per bunch ───────────────────────
UPDATE stock_item_sites sis SET
  reference_order_qty = sis.reference_order_qty * si.pack_size,
  order_qty = CASE WHEN sis.order_qty IS NOT NULL THEN sis.order_qty * si.pack_size ELSE sis.order_qty END,
  updated_at = now()
FROM stock_items si
WHERE sis.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0086' AND si.uom = 'bunch';

UPDATE stock_order_history soh SET order_qty = soh.order_qty * si.pack_size
FROM stock_items si
WHERE soh.item_id = si.id AND si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku = 'SKU-0086' AND si.uom = 'bunch';

UPDATE stock_items SET uom = 'g', order_pack_label = 'bunch', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND sku = 'SKU-0086' AND uom = 'bunch';

-- ── Unpriced/unused PHF herbs: relabel only, nothing to scale ─────────
-- No pack_size/pack_cost set yet and none appear in any recipe, so
-- there's no live number to fix -- this just stops them from becoming
-- the next version of this exact bug once someone prices/uses them.
UPDATE stock_items SET uom = 'g', order_pack_label = 'bunch', updated_at = now()
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND sku IN ('SKU-0162', 'SKU-0082', 'SKU-0164', 'SKU-0156', 'SKU-0155', 'SKU-0168', 'SKU-0159', 'SKU-0153')
  AND uom = 'bunch';

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT si.sku, si.name, si.uom, si.pack_size, si.pack_cost, si.cost_per_uom, si.order_pack_label,
       sis.reference_order_qty, sis.order_qty
FROM stock_items si
JOIN stock_item_sites sis ON sis.item_id = si.id
WHERE si.org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
  AND si.sku IN ('SKU-0050','SKU-0079','SKU-0089','SKU-0073','SKU-0080','SKU-0081','SKU-0076','SKU-0086',
                 'SKU-0162','SKU-0082','SKU-0164','SKU-0156','SKU-0155','SKU-0168','SKU-0159','SKU-0153')
ORDER BY si.name;
