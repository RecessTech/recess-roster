-- ============================================================
-- R-Stock: price update from packaging supplier pricelist
-- ============================================================

UPDATE stock_items SET pack_size = 1000, pack_cost = 42.00  WHERE sku = 'SKU-0171'; -- 8oz Coffee Lid (8TLWPP)
UPDATE stock_items SET pack_size = 800,  pack_cost = 14.00  WHERE sku = 'SKU-0200'; -- Greaseproof Paper (28CH2)
UPDATE stock_items SET pack_size = 250,  pack_cost = 55.00  WHERE sku = 'SKU-0177'; -- Carry Bags (EWTHBMED)
UPDATE stock_items SET pack_size = 200,  pack_cost = 52.00  WHERE sku = 'SKU-0178'; -- Salad Bowl (Kraft) (FC1300K)
UPDATE stock_items SET pack_size = 200,  pack_cost = 29.90  WHERE sku = 'SKU-0179'; -- Salad Lid (FCLIDL)
UPDATE stock_items SET pack_size = 250,  pack_cost = 49.00  WHERE sku = 'SKU-0023'; -- Bin Bags (GBL120R)
UPDATE stock_items SET pack_size = 250,  pack_cost = 101.70 WHERE sku = 'SKU-0181'; -- Soup Container w/ Lids (KSC16COMBO)
UPDATE stock_items SET pack_size = 2000, pack_cost = 22.00  WHERE sku = 'SKU-0026'; -- Napkins (N2PLYCW)
UPDATE stock_items SET pack_size = 1000, pack_cost = 74.00  WHERE sku = 'SKU-0185'; -- Small Coffee Cups (6oz) (SWPF06W)
UPDATE stock_items SET pack_size = 1000, pack_cost = 74.00  WHERE sku = 'SKU-0186'; -- Medium Coffee Cups (8oz) (SWPF08W)
UPDATE stock_items SET pack_size = 1000, pack_cost = 88.00  WHERE sku = 'SKU-0187'; -- Large Coffee Cups (10oz) (SWPF10W)
UPDATE stock_items SET pack_size = 1000, pack_cost = 48.00  WHERE sku = 'SKU-0176'; -- Iced Lids (EW16SL)
UPDATE stock_items SET pack_size = 5000, pack_cost = 110.00 WHERE sku = 'SKU-0189'; -- Wooden Spoons (WTS)
UPDATE stock_items SET pack_size = 1000, pack_cost = 96.00  WHERE sku = 'SKU-0175'; -- Iced Cups (EW14RPET)
UPDATE stock_items SET pack_size = 300,  pack_cost = 76.00  WHERE sku = 'SKU-0182'; -- Sandwich Tubs (PRC1000K)
UPDATE stock_items SET pack_size = 300,  pack_cost = 48.00  WHERE sku = 'SKU-0183'; -- Sandwich Lids (PRCLIDPET)
UPDATE stock_items SET pack_size = 500,  pack_cost = 43.10  WHERE sku = 'SKU-0174'; -- Boats (EOT1B, Open Tray #1 brown kraft)

-- Gloves: ordered one carton = 10 packs of 100 = 1000 gloves, $3.80/pack x 10 = $38.00/carton
UPDATE stock_items SET pack_size = 1000, pack_cost = 38.00  WHERE sku = 'SKU-0188'; -- Gloves (Large) (VGLPF)
UPDATE stock_items SET pack_size = 1000, pack_cost = 38.00  WHERE sku = 'SKU-0191'; -- Gloves (Medium) (VGMPF)

-- Not matched, left alone: WIPRBLUE (Blue wipe roll)

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0171','SKU-0200','SKU-0177','SKU-0178','SKU-0179','SKU-0023','SKU-0181','SKU-0026',
              'SKU-0185','SKU-0186','SKU-0187','SKU-0176','SKU-0189','SKU-0175','SKU-0182','SKU-0183',
              'SKU-0174','SKU-0188','SKU-0191')
ORDER BY name;
