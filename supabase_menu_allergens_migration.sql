-- ============================================================
-- Allergens: per-menu-item allergen declarations
--
-- Seeded from the "Rubric - Allergens" sheet, aligned to the live
-- production_items menu by name. Anything not covered by the rubric has
-- NO row (the app shows it as "not recorded yet"), except a few items
-- whose allergens were derived from R-Recipe ingredient lists -- those
-- are status 'draft' until someone signs them off.
--
-- status:
--   confirmed  rubric entry with nothing outstanding
--   to_check   rubric entry with open supplier-label checks (see notes)
--   draft      derived from recipe ingredients, not verified
--
-- Depends on: supabase-rshift-migration.sql (organisations, is_org_member()),
--             supabase_production_migration.sql (production_items)
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_allergens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  production_item_id  UUID NOT NULL REFERENCES production_items(id) ON DELETE CASCADE,
  ingredients         TEXT NOT NULL DEFAULT '',
  contains            TEXT[] NOT NULL DEFAULT '{}',
  may_contain         TEXT[] NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('confirmed','to_check','draft')),
  notes               TEXT NOT NULL DEFAULT '',
  source              TEXT NOT NULL DEFAULT 'manual',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_item_id),
  -- Only the names the Food Standards Code (Standard 1.2.3, Schedule 9) requires,
  -- plus 'gluten' for the summary statement. Tree nuts are named individually
  -- (never "tree nuts"); barley/oats/rye only when they contain gluten.
  CONSTRAINT menu_allergens_names_chk CHECK (
    contains    <@ ARRAY['wheat','gluten','barley','oats','rye','fish','crustacean','mollusc','egg','milk','lupin','peanut','soy','sesame','almond','brazil nut','cashew','hazelnut','macadamia','pecan','pistachio','pine nut','walnut','sulphites']::text[]
    AND may_contain <@ ARRAY['wheat','gluten','barley','oats','rye','fish','crustacean','mollusc','egg','milk','lupin','peanut','soy','sesame','almond','brazil nut','cashew','hazelnut','macadamia','pecan','pistachio','pine nut','walnut','sulphites']::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_menu_allergens_org_id ON menu_allergens(org_id);

ALTER TABLE menu_allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_allergens_all" ON menu_allergens
  FOR ALL USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));

-- Seed (idempotent: re-running never overwrites edits made after the first run)
INSERT INTO menu_allergens (org_id, production_item_id, ingredients, contains, may_contain, status, notes, source)
SELECT p.org_id, p.id, v.ingredients, v.contains, v.may_contain, v.status, v.notes, v.source
FROM (VALUES
  ('Chicken Avo', 'Chicken Mix (chicken breast, mayonnaise (pasteurised whole egg), seeded mustard, chives, fennel seed, lemon,), sourdough bread (wheat flour, water, starter, salt, malt), avocado, baby gem lettuce, butter (milk), chives, salt, pepper', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'confirmed', 'Rubric: From Rubric Only inc Inifinty', 'rubric'),
  ('Ham, Cheese & Pickle', 'Sourdough bread (wheat flour, water, starter, salt, malt), shaved ham, swiss cheese (milk), pickle, tomato relish, butter (milk), salt, pepper', ARRAY['wheat','gluten','milk']::text[], ARRAY['egg','sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric: From Rubric Only inc Inifinty- need to get tom relish PIF and ham and cheese PIF and pickles', 'rubric'),
  ('BLT', 'Sourdough bread (wheat flour, water, starter, salt, malt), streaky bacon, baby gem lettuce, tomato, mayonnaise (pasteurised whole egg), butter (milk), salt, pepper', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric ingredients list butter (milk) but Contains omitted milk - added. Rubric: Need to get bacon Pifs', 'rubric'),
  ('Pastrami', 'Sourdough bread (wheat flour, water, starter, salt, malt), pastrami, swiss cheese (milk), sauerkraut, pickles, seeded mayonnaise (pasteurised whole egg), butter (milk), salt, pepper', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric: Need to get Pastrami, swiss cheese and sauerkraut and pickles', 'rubric'),
  ('Super Green', 'Sourdough bread (wheat flour, water, starter, salt, malt), avodado, kale, cucumber, pickled onion, roast tomato (tomato, balsamic vinegar, salt, pepper), rocket, dill, chilli vegan mayonnaise, salt, pepper', ARRAY['wheat','gluten']::text[], ARRAY['egg','milk','sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric: Need to check chilli part', 'rubric'),
  ('The Big Tuna', 'Tuna mix (tuna, mayonnaise (egg), dijon mustard, chives, dill, celery), sourdough bread (wheat flour, water, starter, salt, malt), baby gem lettuce, zucchini pickle, butter (milk), salt, pepper', ARRAY['fish','wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'confirmed', '', 'rubric'),
  ('Curried Egg', 'Curried egg mix (egg, mayonnaise (egg), celery, curry powder, salt), sourdough bread (wheat flour, water, starter, salt, malt), baby gem lettuce, butter (milk), salt, pepper', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric ingredients list butter (milk) but Contains omitted milk - added. Rubric: Check curry powder', 'rubric'),
  ('Recess Club', 'Chicken club mix (chicken breast, mayonnaise (pasteurised whole egg), dijon mustard, vinegar, parmesan (milk), garlic powder, fennel seed, lemon), sourdough bread (wheat flour, water, starter, salt, malt), streaky bacon, baby gem lettuce, dill pickle, butter (milk), salt, pepper', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric: check on pickle and mustards', 'rubric'),
  ('Pesto Chook', 'Pesto chicken mix (chicken breast, basil pesto (pine nuts, cashew nuts, parmesan cheese (milk), sourdough bread (wheat flour, water, starter, salt, malt), swiss cheese (milk), pickled zucchini, roasted capsicum, mayonnaise (pasteurised whole egg), butter (milk), parmesan cheese (milk), salt, pepper', ARRAY['wheat','gluten','milk','pine nut','cashew','egg']::text[], ARRAY['sesame']::text[], 'confirmed', '', 'rubric'),
  ('Tuna Melt', 'Tuna mix (tuna, mayonnaise (egg), dijon mustard, chives, dill, celery), sourdough bread (wheat flour, water, starter, salt, malt), american cheese (milk), dill pickles, american mustard, butter (milk), salt, pepper', ARRAY['fish','wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric: Check burger cheese ingredients , check american mustard ingredients', 'rubric'),
  ('B&E Toastie', 'Sourdough bread (wheat flour, water, starter, salt, malt) milk, salt, fresh yeast, improver, butter, sugar), eggs (egg, milk, swiss cheese (milk), parmesan (milk), streaky bacon, chilli jam, chives, butter (milk), salt, pepper, olive oil', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'to_check', 'Rubric: Check bacon , check chilli jam', 'rubric'),
  ('El Diablo', 'Sourdough bread (wheat flour, water, starter, salt, malt), shaved ham, swiss cheese (milk), pastrami, Jalapeños, chilli crisp, honey, butter (milk), salt, pepper', ARRAY['wheat','gluten','milk']::text[], ARRAY['pistachio','pine nut','cashew','egg','sesame']::text[], 'confirmed', 'Rubric: chilli crisp', 'rubric'),
  ('Yoghurt Cup', 'Greek Yoghurt (milk), berry compote (raspberry, blackberry, blueberry, sugar), granola, coconut flakes, strawberry', ARRAY['milk']::text[], ARRAY['pistachio','pine nut','cashew','egg','gluten','sesame']::text[], 'to_check', 'Rubric: check berry compote, check granola iingredients, check coconut flakes Recipe also includes muesli and coconut chips - not covered by rubric Contains.', 'rubric'),
  ('Tomato & Cheese', 'Sourdough bread (wheat flour, water, starter, salt, malt), tomato, swiss cheese (milk), butter (milk), pepper', ARRAY['wheat','gluten','milk','sesame']::text[], ARRAY['pistachio','pine nut','cashew','egg']::text[], 'confirmed', '', 'rubric'),
  ('Cheese Toastie', 'Sourdough bread (wheat flour, water, starter, salt, malt), swiss cheese (milk), american cheese (milk), parmesan cheese (milk), butter, everything recess seasoning (sesame seeds), butter (milk) salt, pepper', ARRAY['wheat','gluten','milk','sesame']::text[], ARRAY['pistachio','pine nut','cashew','egg']::text[], 'to_check', 'Rubric: check american cheese, check recess seasoning', 'rubric'),
  ('Toast', 'Sourdough bread (wheat flour, water, starter, salt, malt), vegemite (wheat, barley), butter (milk)', ARRAY['wheat','gluten','milk']::text[], ARRAY['pistachio','pine nut','cashew','egg','sesame']::text[], 'confirmed', 'Matched from rubric "Vegemite Toast".', 'rubric'),
  ('Chicken & Greens', 'Pesto chicken mix (chicken breast, basil pesto (pine nuts, cashew nuts, parmesan cheese (milk)), baby gem lettuce, rocket, cucumber, cherry tomato, fetta (milk), pickled onion, dill, pepitas', ARRAY['pine nut','cashew','milk']::text[], ARRAY['gluten','wheat','sesame','egg','pistachio']::text[], 'to_check', 'Rubric: check fetta', 'rubric'),
  ('Veg & Grains', 'Sweet potato, quinoa, kale, rocket, chickpeas, tomatoes, avocado, peas, recess vinaigrette dressing (vinegar, dijon mustard, sugar, salt, pepper), everything recess seasoning (sesame seeds), pistachio', ARRAY['pistachio','sesame']::text[], ARRAY['wheat','gluten','milk','egg','cashew','pine nut']::text[], 'confirmed', '', 'rubric'),
  ('Chicken Caesar', 'Chicken club mix (chicken breast, mayonnaise (pasteurised egg), dijon mustard, vinegar, parmesan (milk), garlic powder, fennel seed, lemon), streaky bacon, parmesan (milk), cos lettuce, croutons (sourdough bread (wheat flour, water, starter, salt, malt), garlic powder), ceaser dressing (mayonnaise (pasteurised egg), dijon mustard, vinegar, parmesan (milk), garlic powder)', ARRAY['wheat','gluten','milk','egg']::text[], ARRAY['sesame','pine nut','cashew','pistachio']::text[], 'confirmed', 'Rubric ingredients list mayonnaise/dressing (egg) but Contains omitted egg - added.', 'rubric'),
  ('Croissant', 'Euro flour (wheat), salt, sugar, improver, filtered water, fresh yeast, butter (milk), egg', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['pistachio','sesame','cashew','pine nut']::text[], 'confirmed', '', 'rubric'),
  ('Almond Croissant', 'Euro flour (wheat), salt, sugar, improver, filtered water, fresh yeast, butter (milk), unsalted butter (milk), almond,  egg', ARRAY['wheat','gluten','egg','milk','almond']::text[], ARRAY['pistachio','sesame','cashew','pine nut']::text[], 'confirmed', 'Rubric ingredients list almond but Contains omitted almond - added.', 'rubric'),
  ('Chocolate Croissant', 'Euro flour (wheat), salt, sugar, improver, filtered water, fresh yeast, butter (milk), Valrhona chocolate stick (milk), egg', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['pistachio','sesame','cashew','pine nut']::text[], 'confirmed', '', 'rubric'),
  ('Ham & Cheese Croissant', 'Ham, swiss cheese (milk), croissant (euro flour (wheat), salt, sugar, improver, filtered water, fresh yeast, butter (milk), egg)', ARRAY['wheat','gluten','egg','milk']::text[], ARRAY['pistachio','sesame','cashew','pine nut']::text[], 'confirmed', '', 'rubric'),
  ('Banana Bread', 'Fresh banana, brown sugar, sugar, honey, egg, vegetable oil, plain flour (wheat), baking powder, bi-soda, salt, mixed spice (sesame seed), cinnamon, star anise, cardamon, cloves', ARRAY['wheat','gluten','egg','sesame']::text[], ARRAY['pistachio','cashew','pine nut','milk']::text[], 'confirmed', 'Rubric ingredients list mixed spice (sesame seed) but Contains omitted sesame - added.', 'rubric'),
  ('Chickpea Smash', '', ARRAY['wheat','gluten','soy']::text[], ARRAY['sesame','pistachio','pine nut','cashew','milk','egg']::text[], 'to_check', 'No ingredient list in rubric - Contains not traceable.', 'rubric'),
  ('Chilli Turk', 'Bread, butter, mayo, turkey, rocket, brown onion, balsamic vinegar, chilli crisp', ARRAY['wheat','gluten','milk','egg']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'draft', 'Derived from R-Recipe ingredient list, not a signed-off spec. Check chilli crisp and balsamic (sulphites) labels.', 'recipe'),
  ('Mushroom & Egg', 'Bread, butter, eggs, mayo, swiss, grated parmesan, chives', ARRAY['wheat','gluten','milk','egg']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'draft', 'Derived from R-Recipe ingredient list, not a signed-off spec. Check mushroom prep for added ingredients.', 'recipe'),
  ('Roast Beef & Onion', 'Bread, butter, roast beef, swiss, mayo, horseradish, brown onion, balsamic vinegar', ARRAY['wheat','gluten','milk','egg']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'draft', 'Derived from R-Recipe ingredient list, not a signed-off spec. Check horseradish and balsamic (sulphites) labels.', 'recipe'),
  ('Triple C', 'Bread, butter, cooked chicken, swiss, mayo, seeded mustard, jalapenos, chilli crisp', ARRAY['wheat','gluten','milk','egg']::text[], ARRAY['sesame','pistachio','pine nut','cashew']::text[], 'draft', 'Derived from R-Recipe ingredient list, not a signed-off spec. Check seeded mustard and chilli crisp labels.', 'recipe')
) AS v(name, ingredients, contains, may_contain, status, notes, source)
JOIN production_items p ON p.name = v.name AND p.active
ON CONFLICT (production_item_id) DO NOTHING;
