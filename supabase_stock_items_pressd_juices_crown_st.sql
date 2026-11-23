-- Assigns the Press'd juice range to Crown St, with Bidfood as supplier
-- and each item's Bidfood catalog code (supplier_code), as shown in the
-- Bidfood ordering screenshot. Data-only change applied live via
-- execute_sql, recorded here for reproducibility.

INSERT INTO stock_item_sites (org_id, item_id, location_id, supplier, supplier_code)
SELECT '788c4cea-50dd-4284-a218-3a971c8b510d', si.id, 'ef30975d-1a70-4d4f-9004-3721ebcdeddf', 'Bidfood', codes.code
FROM (VALUES
  ('SKU-0213', '230755'), -- Press'd Juice - Orange
  ('SKU-0214', '230760'), -- Press'd Juice - Cloudy Apple
  ('SKU-0215', '230759'), -- Press'd Juice - Watermelon Apple & Mint
  ('SKU-0216', '230758'), -- Press'd Juice - Apple Orange Beetroot & Carrot
  ('SKU-0217', '230757'), -- Press'd Juice - Orange Carrot Pineapple & Ginger
  ('SKU-0219', '230756')  -- Press'd Juice - Kale Celery Ginger Apple & Lemon
) AS codes(sku, code)
JOIN stock_items si ON si.sku = codes.sku AND si.org_id = '788c4cea-50dd-4284-a218-3a971c8b510d'
RETURNING item_id, supplier, supplier_code;
