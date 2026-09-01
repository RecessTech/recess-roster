-- ============================================================
-- Categorize remaining stock_items (one-off data fix, not a schema
-- migration). Covers the P-Z range that the first categorization
-- pass (supabase-stock-categorize-existing.sql) never reached -- that
-- one only covered A-O. Matches by name within your org.
-- ============================================================

UPDATE stock_items si
SET category = v.category, updated_at = NOW()
FROM (VALUES
  ('Orange Carrot Tumeric Juice', 'BEV'),
  ('Orange Mango Juice', 'BEV'),
  ('Oregano', 'PHF'),
  ('Paper Towel', 'CLN'),
  ('Parlsey', 'PHF'),
  ('Parsnip', 'PHF'),
  ('Passionfruit Pulp', 'DRY'),
  ('Pastrami', 'PTN'),
  ('Peeled Potato', 'PHF'),
  ('Pepitas', 'DRY'),
  ('Peppercorns', 'DRY'),
  ('Pesto', 'DRY'),
  ('Pickled Cucumber', 'DRY'),
  ('Pitted Dates', 'DRY'),
  ('Poppy Seeds', 'DRY'),
  ('Pumpkin Peeled & Diced', 'PHF'),
  ('Quinoa', 'DRY'),
  ('Raw Sugar', 'DRY'),
  ('Red Bull', 'BEV'),
  ('Red Bull - Sugar Free', 'BEV'),
  ('Red Cabbage', 'PHF'),
  ('Red Lentils', 'DRY'),
  ('Red Onion', 'PHF'),
  ('Red Peppers', 'PHF'),
  ('Ricotta', 'DAI'),
  ('Rinse Aid', 'CLN'),
  ('Roast Beef', 'PTN'),
  ('Rocket', 'PHF'),
  ('Rolled Oats', 'DRY'),
  ('Samboys', 'SNK'),
  ('Sauerkraut', 'DRY'),
  ('Seeded Mustard', 'DRY'),
  ('Shallots (Spring Onion)', 'PHF'),
  ('Skim Milk', 'DAI'),
  ('Sliced Mushroom', 'PHF'),
  ('Soy Milk', 'DAI'),
  ('Sparkling', 'BEV'),
  ('Spray & Wipe Mix', 'CLN'),
  ('Strawberries', 'PHF'),
  ('Strawberry Puree', 'FZN'),
  ('Sundried Tomato Strips', 'DRY'),
  ('Sweet Potato', 'PHF'),
  ('Swiss', 'DAI'),
  ('Swiss Mushroom', 'PHF'),
  ('Table Salt', 'DRY'),
  ('Tamari Almonds', 'SNK'),
  ('Tarragon', 'PHF'),
  ('Thai Basil', 'PHF'),
  ('Thickened Cream', 'DAI'),
  ('Thyme', 'PHF'),
  ('Toasted Sesame Seeds', 'DRY'),
  ('Toilet Paper', 'CLN'),
  ('Tomato', 'PHF'),
  ('Tomato Chutney', 'DRY'),
  ('Tomato Sauce', 'DRY'),
  ('Tuna', 'PTN'),
  ('Turkey Slces', 'PTN'),
  ('Turmeric', 'DRY'),
  ('Vanilla Syrup', 'DRY'),
  ('Vegan Mayo', 'DRY'),
  ('Vegemite', 'DRY'),
  ('Washed Cos Leaves', 'PHF'),
  ('Water', 'BEV'),
  ('White Sugar', 'DRY'),
  ('White Vinegar', 'DRY'),
  ('White Wine Vinegar', 'DRY'),
  ('Whittakers Peanut Slab', 'SNK'),
  ('Wraps', 'DRY'),
  ('Yoghurt', 'DAI'),
  ('Zucchini', 'PHF')
) AS v(name, category)
WHERE si.name = v.name
  AND si.org_id = (
    SELECT om.org_id FROM org_members om
    JOIN auth.users u ON u.id = om.user_id
    WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1
  );

-- Verify: anything in the WHOLE catalog still uncategorized?
SELECT name, sku FROM stock_items
WHERE (category IS NULL OR category = '')
  AND org_id = (SELECT om.org_id FROM org_members om JOIN auth.users u ON u.id = om.user_id WHERE u.email = 'clark@itsrecess.com.au' LIMIT 1)
ORDER BY name;
