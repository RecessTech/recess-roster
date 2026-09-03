-- Sundried Tomato: $10.90/kg -> $11.00/kg
-- Source: FoodByUs NSW-2630651, "Tomato Strips Sundried 5LT" (Elegre) @ $55.00,
-- treated as a 5kg tub per confirmation (not the Bidfood 2kg fresh-strips line).
UPDATE stock_items SET pack_size = 5000, pack_cost = 55.00
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sundried Tomato';

SELECT name, pack_size, pack_cost, cost_per_uom
FROM stock_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Crown St' LIMIT 1) AND name = 'Sundried Tomato';
