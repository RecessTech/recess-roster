-- ============================================================
-- R-Stock: price update from Fruitique produce/herbs pricelist
-- ============================================================

UPDATE stock_items SET pack_size = 5500, pack_cost = 39.80 WHERE sku = 'SKU-0069'; -- Avos (Avocados - Hass)
UPDATE stock_items SET pack_size = 1000, pack_cost = 17.50 WHERE sku = 'SKU-0052'; -- Tamari Almonds
UPDATE stock_items SET pack_size = 1000, pack_cost = 2.79  WHERE sku = 'SKU-0075'; -- Carrots (A Grade)
UPDATE stock_items SET pack_size = 400,  pack_cost = 2.99  WHERE sku = 'SKU-0073'; -- Celery
UPDATE stock_items SET pack_size = 125,  pack_cost = 9.40  WHERE sku = 'SKU-0080'; -- Chives (Market Bunch)
UPDATE stock_items SET pack_size = 1000, pack_cost = 5.99  WHERE sku = 'SKU-0072'; -- Cucumber (Lebanese)
UPDATE stock_items SET pack_size = 125,  pack_cost = 14.99 WHERE sku = 'SKU-0081'; -- Dill (Market Bunch)
UPDATE stock_items SET pack_size = 300,  pack_cost = 1.99  WHERE sku = 'SKU-0076'; -- Kale
UPDATE stock_items SET pack_size = 1000, pack_cost = 3.69  WHERE sku = 'SKU-0083'; -- Lemons
UPDATE stock_items SET pack_size = 3500, pack_cost = 29.80 WHERE sku = 'SKU-0077'; -- Baby Cos Gem (Box of 20)
UPDATE stock_items SET pack_size = 1000, pack_cost = 14.99 WHERE sku = 'SKU-0154'; -- Sliced Mushroom (Button)
UPDATE stock_items SET pack_size = 1000, pack_cost = 4.79  WHERE sku = 'SKU-0085'; -- Brown Onion (Peeled)
UPDATE stock_items SET pack_size = 1500, pack_cost = 21.80 WHERE sku = 'SKU-0079'; -- Rocket (Wild, Box 1.5kg)
UPDATE stock_items SET pack_size = 250,  pack_cost = 3.89  WHERE sku = 'SKU-0089'; -- Strawberries (Premium, Punnet)
UPDATE stock_items SET pack_size = 1000, pack_cost = 2.30  WHERE sku = 'SKU-0088'; -- Sweet Potato (Gold/Kumera)
UPDATE stock_items SET pack_size = 5000, pack_cost = 44.80 WHERE sku = 'SKU-0071'; -- Cherry Toms (Tray)
UPDATE stock_items SET pack_size = 1000, pack_cost = 4.40  WHERE sku = 'SKU-0070'; -- Tomato (Round)
UPDATE stock_items SET pack_size = 1000, pack_cost = 2.99  WHERE sku = 'SKU-0074'; -- Zucchini

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0069','SKU-0052','SKU-0075','SKU-0073','SKU-0080','SKU-0072','SKU-0081','SKU-0076',
              'SKU-0083','SKU-0077','SKU-0154','SKU-0085','SKU-0079','SKU-0089','SKU-0088','SKU-0071',
              'SKU-0070','SKU-0074')
ORDER BY name;
