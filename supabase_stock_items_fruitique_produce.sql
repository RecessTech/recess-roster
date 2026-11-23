-- Adds three Fruitique produce SKUs to the R-Stock catalog for org
-- 788c4cea-50dd-4284-a218-3a971c8b510d ("It's Recess"). Weight-priced
-- items (Kg) follow the existing per-gram convention (e.g. Carrots,
-- Strawberries: uom 'g', pack_size in grams, pack_cost = the per-kg
-- price); the punnet-priced item has no stated weight, so it follows
-- the existing discrete-unit convention instead (uom 'unit',
-- direct_unit_cost). Not yet assigned to a site -- Fruitique's other
-- items (Avos, Cucumber, Strawberries) are all at Crown St, but this
-- batch wasn't given a site to assign to. Data-only change applied
-- live via execute_sql, recorded here for reproducibility.

INSERT INTO stock_items (org_id, name, category, uom, sku, pack_size, pack_cost, active, sort_order)
VALUES
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Beetroot (Julienne)', 'PHF', 'g', 'SKU-0220', 1000, 6.99, true, 0),
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Carrots (Julienne)', 'PHF', 'g', 'SKU-0221', 1000, 5.20, true, 0)
RETURNING sku, name, pack_cost, cost_per_uom;

INSERT INTO stock_items (org_id, name, category, uom, sku, direct_unit_cost, active, sort_order)
VALUES
  ('788c4cea-50dd-4284-a218-3a971c8b510d', 'Alfalfa', 'PHF', 'unit', 'SKU-0222', 1.99, true, 0)
RETURNING sku, name, direct_unit_cost, cost_per_uom;
