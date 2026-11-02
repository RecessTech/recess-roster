-- ============================================================
-- Allergens: RECOMMENDED values for items the rubric doesn't cover
--
-- Run after supabase_menu_allergens_migration.sql. Every row here is
-- status 'draft' (shown in the app as "Draft - unverified"), never
-- 'confirmed'. Values are deliberately cautious: when a product could
-- not be checked, the uncertain allergen goes in may_contain rather
-- than being left out. Each row's notes say what the recommendation is
-- based on and what to verify. Sign off by changing status to 'confirmed'.
--
-- Idempotent: inserts never overwrite an existing row.
-- Section 3 only ADDS may-be-present tokens to existing rubric rows.
-- ============================================================

-- 1. Food and packaged items -----------------------------------------
INSERT INTO menu_allergens (org_id, production_item_id, ingredients, contains, may_contain, status, notes, source)
SELECT p.org_id, p.id, v.ingredients, v.contains, v.may_contain, 'draft', v.notes, 'recommended'
FROM (VALUES
  ('Ham, Cheese & Tomato Toastie', 'Sourdough bread, butter, ham, swiss cheese, tomato',
    ARRAY['wheat','gluten','milk']::text[], ARRAY['egg','sesame','pistachio','pine nut','cashew']::text[],
    'RECOMMENDED. No recipe on file; copied from rubric Ham, Cheese & Pickle (same bread, butter, ham, swiss) minus pickle. Confirm ham PIF.'),
  ('Veg Toastie', '',
    ARRAY['wheat','gluten','milk']::text[], ARRAY['egg','sesame','soy','pistachio','pine nut','cashew']::text[],
    'RECOMMENDED. No recipe on file; assumes sourdough, butter and cheese like the other toasties. Egg/soy shown as may-be-present in case of mayo, pesto or vegan mayo - add the real filling.'),
  ('Birria Toastie', 'Sourdough bread, butter, cheese, slow-cooked beef birria, onion, coriander',
    ARRAY['wheat','gluten','milk']::text[], ARRAY['sulphites','soy','sesame','pistachio','pine nut','cashew']::text[],
    'RECOMMENDED. No recipe on file. Birria is usually dried chillies, spices and vinegar (sulphites, soy from stock/seasoning). Confirm the birria recipe and any consomme dip.'),
  ('Tikka Salad', 'Tikka chicken, salad leaves, vegetables, dressing',
    ARRAY['milk']::text[], ARRAY['gluten','soy','sesame','egg','almond','cashew']::text[],
    'RECOMMENDED. No recipe on file. Tikka marinade is yoghurt-based (milk). Many tikka pastes contain cashew/almond, mustard and gluten - check the paste and dressing labels.'),
  ('Mango Chia Pudding', 'Chia seeds, coconut milk, frozen mango, maple syrup, salt, goji berries, muesli, coconut chips',
    ARRAY['oats','gluten']::text[], ARRAY['almond','cashew','hazelnut','sesame','milk','soy','wheat']::text[],
    'RECOMMENDED. Built from the R-Recipe lines. Rubric column was blank. Muesli is the unknown: usually oats (gluten), sometimes wheat and often nuts, seeds, milk powder - check muesli label. Coconut is not a declarable allergen in AU.'),
  ('Portuguese Tart', 'Pastry, egg custard',
    ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['soy','sesame','pistachio','pine nut','cashew']::text[],
    'RECOMMENDED. Bought-in item with no spec. Standard custard tart: pastry (wheat), egg yolk and cream/milk custard. Pastry fat may include soy lecithin. Get the supplier spec.'),
  ('Butterboy Cookie - Snickerdoodle', 'Butter, sugars, eggs, plain flour, cinnamon, raising agents, salt',
    ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['almond','hazelnut','macadamia','peanut','soy','sesame']::text[],
    'RECOMMENDED. Based on Butterboy-style ingredient lists seen on third-party cafe listings (butter, sugars, eggs, plain flour); no official Butterboy spec found. Bakery likely handles nuts - ask Butterboy.'),
  ('Butterboy Cookie - Milk Choc Chip', 'Butter, sugars, eggs, plain flour, milk chocolate, raising agents, salt',
    ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['soy','almond','hazelnut','macadamia','peanut','sesame']::text[],
    'RECOMMENDED. As Snickerdoodle, plus milk chocolate (milk, usually soy lecithin). No official spec found.'),
  ('Butterboy Cookie - Salted Caramel', 'Butter, sugars, eggs, plain flour, caramel, raising agents, salt',
    ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['macadamia','almond','hazelnut','soy','peanut','sesame']::text[],
    'RECOMMENDED. A similar salted-caramel cookie on a third-party cafe listing contained macadamias - confirm whether Butterboy''s does. Caramel adds milk.'),
  ('Butterboy Cookie - Nutella Choc Chip', 'Butter, sugars, eggs, plain flour, chocolate chips, hazelnut chocolate spread, raising agents, salt',
    ARRAY['wheat','gluten','egg','milk','hazelnut','soy']::text[], ARRAY['almond','macadamia','peanut','sesame']::text[],
    'RECOMMENDED. Nutella is hazelnut + milk + soy lecithin. No official Butterboy spec found.'),
  ('Butterboy Cookie - Bueno', 'Butter, sugars, eggs, plain flour, Kinder Bueno pieces, raising agents, salt',
    ARRAY['wheat','gluten','egg','milk','hazelnut','soy']::text[], ARRAY['almond','macadamia','peanut','sesame']::text[],
    'RECOMMENDED. Kinder Bueno contains hazelnut, milk, wheat and soy lecithin. No official Butterboy spec found.'),
  ('Butterboy Cookie - Monthly Special', '',
    ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['almond','hazelnut','macadamia','peanut','soy','sesame']::text[],
    'RECOMMENDED BASE ONLY. Flavour changes monthly - add that month''s inclusions (nuts, chocolate, etc.) each time.'),
  ('Killer Python', 'Glucose syrup, sugar, starch (wheat or corn), gelatine, food acid, flavours, colours',
    ARRAY['wheat','gluten']::text[], ARRAY['milk']::text[],
    'RECOMMENDED. Matches Allen''s Killer Pythons retailer listings (Officeworks, IGA, Chemist Warehouse): wheat, gluten; may contain traces of milk. Check the pack if the flavour/size changes.'),
  ('Samboys', '',
    '{}'::text[], ARRAY['milk','soy','gluten']::text[],
    'RECOMMENDED - LOW CONFIDENCE. Could not find a Samboy allergen statement online and it depends on flavour. Plain potato chips often have no declared allergens but seasoned flavours can have milk/soy. Read the pack for the flavours you stock.'),
  ('Mecca Coffee Beans 1kg', 'Roasted coffee beans',
    '{}'::text[], '{}'::text[],
    'RECOMMENDED. Retail whole-bean coffee - no allergens expected.'),
  ('TGTG Surprise Bag', 'Contents vary daily',
    '{}'::text[], ARRAY['gluten','wheat','egg','milk','soy','sesame','fish','peanut','almond','cashew','hazelnut','macadamia','pistachio','pine nut','walnut','crustacean','sulphites']::text[],
    'Contents vary every day so allergens cannot be listed. Tell customers to ask, and check the bag contents.'),
  ('Coke', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Soft drink - no declared allergens. Check pack.'),
  ('Coke No Sugar', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Soft drink - no declared allergens. Check pack.'),
  ('Diet Coke', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Soft drink - no declared allergens. Check pack.'),
  ('Sparkling Water', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Water - no allergens.'),
  ('Water Bottle', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Water - no allergens.'),
  ('Bobby Soda - Ginger Beer', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Soda, no declared allergens expected - check pack.'),
  ('Bobby Soda - Passionfruit', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Soda, no declared allergens expected - check pack.'),
  ('Almighty Sparkling - Blood Orange', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. Sparkling juice drink, no declared allergens expected - check pack.'),
  ('Mateo Mate Soda', '', '{}'::text[], '{}'::text[], 'RECOMMENDED - LOW CONFIDENCE. Could not find the product label online; yerba mate sodas normally declare no allergens but some use sulphite caramel colour. Check pack.'),
  ('Dear San - Matcha Coconut Water', 'Coconut water, Japanese matcha', '{}'::text[], '{}'::text[], 'RECOMMENDED. Listed retailer description is coconut water + matcha only. Coconut is not a declarable allergen in AU. Check pack.'),
  ('Almighty Juice - Apple', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. 100% juice - no allergens. Check pack.'),
  ('Almighty Juice - Apple, Blackcurrant & Boysenberry', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. 100% juice - no allergens. Check pack.'),
  ('Almighty Juice - Apple, Guava & Lime', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. 100% juice - no allergens. Check pack.'),
  ('Almighty Juice - Carrot, Orange & Turmeric', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. 100% juice - no allergens. Check pack.'),
  ('Almighty Juice - Orange', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. 100% juice - no allergens. Check pack.'),
  ('Almighty Juice - Orange, Apple & Mango', '', '{}'::text[], '{}'::text[], 'RECOMMENDED. 100% juice - no allergens. Check pack.'),
  -- Soups: no recipes in R-Recipe, so these are assumptions about standard recipes.
  ('Chicken Noodle Soup', 'Chicken, noodles, vegetables, stock',
    ARRAY['wheat','gluten']::text[], ARRAY['egg','soy','milk','sesame']::text[],
    'RECOMMENDED - NO RECIPE. Noodles = wheat/gluten (egg noodles would add egg). Stock/seasoning may contain soy, gluten or milk. Build the recipe in R-Recipe to confirm.'),
  ('Tomato Soup', 'Tomato, onion, stock',
    '{}'::text[], ARRAY['milk','gluten','soy','sulphites']::text[],
    'RECOMMENDED - NO RECIPE. Often finished with cream or butter (milk) and thickened with flour; stock may contain gluten/soy. Confirm recipe.'),
  ('Red Lentil Soup', 'Red lentils, onion, spices, stock',
    '{}'::text[], ARRAY['gluten','soy','milk']::text[],
    'RECOMMENDED - NO RECIPE. Naturally allergen-free base; stock/spice mix and any butter or yoghurt garnish are the risk. Confirm recipe.'),
  ('Split Pea Soup', 'Split peas, onion, vegetables, stock',
    '{}'::text[], ARRAY['gluten','soy','milk']::text[],
    'RECOMMENDED - NO RECIPE. Naturally allergen-free base; check stock, and whether ham/bacon or butter is used.'),
  ('Thai Pumpkin Soup', 'Pumpkin, coconut milk, Thai curry paste, stock',
    '{}'::text[], ARRAY['crustacean','fish','soy','gluten','sesame']::text[],
    'RECOMMENDED - NO RECIPE. Thai curry paste and fish sauce often contain shrimp paste (crustacean) and fish. Pumpkin is on the stock list. Check the paste label.')
) AS v(name, ingredients, contains, may_contain, notes)
JOIN production_items p ON p.name = v.name AND p.active
ON CONFLICT (production_item_id) DO NOTHING;

-- 2. Coffee & Tea ------------------------------------------------------
-- Black coffee/tea: nothing. Everything else is milk-based; default milk is
-- full cream, so milk is "contains" and the alternative milks (soy, almond,
-- oat = gluten) are "may be present" depending on what the customer chooses.
INSERT INTO menu_allergens (org_id, production_item_id, ingredients, contains, may_contain, status, notes, source)
SELECT p.org_id, p.id, '',
  CASE
    WHEN p.name ~* '^(espresso|short black|long black|iced long black|cold brew|english breakfast tea|green tea)' THEN '{}'::text[]
    WHEN p.name ~* 'milo' THEN ARRAY['milk','barley','gluten']::text[]
    ELSE ARRAY['milk']::text[]
  END,
  CASE
    WHEN p.name ~* '^(espresso|short black|long black|iced long black|cold brew|english breakfast tea|green tea)' THEN '{}'::text[]
    ELSE ARRAY['soy','almond','oats','gluten']::text[]
  END,
  'draft',
  CASE
    WHEN p.name ~* '^(espresso|short black|long black|iced long black|cold brew|english breakfast tea|green tea)'
      THEN 'RECOMMENDED. Black coffee/tea - no allergens.'
    ELSE 'RECOMMENDED. Assumes full-cream milk: contains milk. If the customer swaps milk: soy milk adds soy, almond milk adds almond, oat milk adds oats (gluten). Confirm the chai powder, chocolate powder and syrup labels (milk/soy are common).'
  END,
  'recommended'
FROM production_items p
WHERE p.active AND p.category = 'Coffee & Tea'
ON CONFLICT (production_item_id) DO NOTHING;

-- 3. Cautious additions to existing rubric rows (adds only, never removes) -----
-- Chilli crisp is typically soy + sesame based (sometimes peanut): add soy as a
-- may-be-present on every item that uses it until the label is checked.
-- Balsamic vinegar/glaze commonly carries sulphites >= 10mg/kg.
-- Almond Croissant is made on site, so almond may be present on other bakery.
UPDATE menu_allergens m SET
  may_contain = ARRAY(SELECT DISTINCT unnest(m.may_contain || ARRAY['soy'])),
  notes = trim(m.notes || ' RECOMMENDED: chilli crisp label not checked - typically soy and sesame, sometimes peanut. Added soy as may-be-present.')
FROM production_items p
WHERE p.id = m.production_item_id AND p.name IN ('El Diablo','Chilli Turk','Triple C') AND NOT ('soy' = ANY(m.contains));

UPDATE menu_allergens m SET
  may_contain = ARRAY(SELECT DISTINCT unnest(m.may_contain || ARRAY['sulphites'])),
  notes = trim(m.notes || ' RECOMMENDED: balsamic vinegar/glaze usually contains sulphites >=10mg/kg - added as may-be-present. Check the label.')
FROM production_items p
WHERE p.id = m.production_item_id AND p.name IN ('Super Green','Veg & Grains');

UPDATE menu_allergens m SET
  may_contain = ARRAY(SELECT DISTINCT unnest(m.may_contain || ARRAY['soy'])),
  notes = trim(m.notes || ' RECOMMENDED: vegan mayo is often soy- or chickpea-based - check the label. Added soy as may-be-present.')
FROM production_items p
WHERE p.id = m.production_item_id AND p.name = 'Super Green' AND NOT ('soy' = ANY(m.contains));

UPDATE menu_allergens m SET
  may_contain = ARRAY(SELECT DISTINCT unnest(m.may_contain || ARRAY['almond'])),
  notes = trim(m.notes || ' RECOMMENDED: almond croissants are made on site - almond added as may-be-present.')
FROM production_items p
WHERE p.id = m.production_item_id AND p.category = 'Bakery' AND p.name <> 'Almond Croissant'
  AND NOT ('almond' = ANY(m.contains)) AND m.source = 'rubric';

UPDATE menu_allergens m SET
  contains = ARRAY(SELECT DISTINCT unnest(m.contains || ARRAY['oats','gluten'])),
  may_contain = ARRAY(SELECT DISTINCT unnest(m.may_contain || ARRAY['almond','cashew','hazelnut','sesame','wheat'])),
  notes = trim(m.notes || ' RECOMMENDED: muesli added oats (gluten) and nut/seed may-be-present - rubric only listed milk.')
FROM production_items p
WHERE p.id = m.production_item_id AND p.name = 'Yoghurt Cup' AND NOT ('gluten' = ANY(m.contains));

-- Vegemite is wheat + barley; barley must be declared by name when it contains gluten.
UPDATE menu_allergens m SET
  contains = ARRAY(SELECT DISTINCT unnest(m.contains || ARRAY['barley'])),
  notes = trim(m.notes || ' RECOMMENDED: rubric ingredients show vegemite (wheat, barley) - barley added so the cereal is declared by name.')
FROM production_items p
WHERE p.id = m.production_item_id AND p.name = 'Toast' AND NOT ('barley' = ANY(m.contains));

-- Tidy: never list an allergen as both "contains" and "may be present".
UPDATE menu_allergens SET may_contain = ARRAY(SELECT x FROM unnest(may_contain) x WHERE NOT (x = ANY(contains)))
WHERE may_contain && contains;
