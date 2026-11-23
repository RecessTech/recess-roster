-- Adds the Press'd juice range (Bidfood, Chiller) to the R-Stock SKU
-- catalog for org 788c4cea-50dd-4284-a218-3a971c8b510d ("It's Recess").
-- Pack size/cost taken from Bidfood's ordering catalog (10 x 300ML
-- cartons at $27.21) -- cost_per_uom is a generated column and lines
-- up exactly with Bidfood's quoted PCE price. Data-only change applied
-- live via execute_sql, recorded here for reproducibility.
--
-- The Daily Shot Citrus Blend (SKU-0218, originally included here) was
-- added and then removed in the same session -- per Clark, it isn't
-- actually a Press'd product despite appearing alongside them in the
-- Bidfood catalog screenshot.

INSERT INTO stock_items (org_id, name, category, uom, sku, pack_size, units_per_carton, pack_cost, active, sort_order)
VALUES
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Press''d Juice - Orange', 'BEV', 'units', 'SKU-0213', 10, 10, 27.21, true, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Press''d Juice - Cloudy Apple', 'BEV', 'units', 'SKU-0214', 10, 10, 27.21, true, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Press''d Juice - Watermelon Apple & Mint', 'BEV', 'units', 'SKU-0215', 10, 10, 27.21, true, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Press''d Juice - Apple Orange Beetroot & Carrot', 'BEV', 'units', 'SKU-0216', 10, 10, 27.21, true, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Press''d Juice - Orange Carrot Pineapple & Ginger', 'BEV', 'units', 'SKU-0217', 10, 10, 27.21, true, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Press''d Juice - Kale Celery Ginger Apple & Lemon', 'BEV', 'units', 'SKU-0219', 10, 10, 27.21, true, 0)
RETURNING sku, name, pack_cost, cost_per_uom;
