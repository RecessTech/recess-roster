-- ============================================================
-- R-Stock: price 10 previously-unpriced SKUs from the Bidfood invoices
-- ============================================================
-- These were unpriced with 0 recipe references, so pack_size is set
-- using the face value of the existing uom (L = litres, kg =
-- kilograms, tin/12-pack = 1 pack) rather than the gram-scaled
-- convention seen elsewhere in the catalog -- there's no existing
-- recipe quantity to stay consistent with.

UPDATE stock_items SET pack_size = 12, pack_cost = 20.46 WHERE sku = 'SKU-0106'; -- Full Cream Milk, Yarde Farm 6x2L
UPDATE stock_items SET pack_size = 12, pack_cost = 20.53 WHERE sku = 'SKU-0107'; -- Skim Milk, Yarde Farm 6x2L
UPDATE stock_items SET pack_size = 12, pack_cost = 37.08 WHERE sku = 'SKU-0108'; -- Almond Milk, Alternative 12x1L
UPDATE stock_items SET pack_size = 12, pack_cost = 35.64 WHERE sku = 'SKU-0109'; -- Oat Milk, Alternative 12x1L
UPDATE stock_items SET pack_size = 12, pack_cost = 35.16 WHERE sku = 'SKU-0110'; -- Soy Milk, Alternative 12x1L
UPDATE stock_items SET pack_size = 1,  pack_cost = 3.02  WHERE sku = 'SKU-0129'; -- Passionfruit Pulp, John West 170g tin
UPDATE stock_items SET pack_size = 1,  pack_cost = 7.67  WHERE sku = 'SKU-0017'; -- Tomato Sauce, Masterfoods 920mL squeeze bottle
UPDATE stock_items SET pack_size = 1,  pack_cost = 6.19  WHERE sku = 'SKU-0123'; -- Water, Eastcoast 12x600mL carton
UPDATE stock_items SET pack_size = 1,  pack_cost = 21.11 WHERE sku = 'SKU-0116'; -- Vanilla Syrup, Monin 1L bottle
UPDATE stock_items SET pack_size = 1,  pack_cost = 23.06 WHERE sku = 'SKU-0131'; -- Chai Powder, arkadia 1kg pack

SELECT name, sku, uom, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE sku IN ('SKU-0106','SKU-0107','SKU-0108','SKU-0109','SKU-0110','SKU-0129','SKU-0017','SKU-0123','SKU-0116','SKU-0131')
ORDER BY name;
