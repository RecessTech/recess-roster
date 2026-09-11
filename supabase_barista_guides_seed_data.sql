-- R-Barista: seed initial Drinks Guide content for Coffee & Tea items.
-- Steps adapted from the team's existing drink-build reference doc, cross-checked
-- against each item's real R-Recipe ingredient lines so the method matches what's
-- actually in the cup. Items with no doc entry (Macchiato, Short Black, Iced
-- Chocolate, Iced Banana, Banana Iced Latte, Iced Milo Mocha, Hot Chocolate,
-- Babyccino, both teas) use inferred steps consistent with the rest of the range.

-- Flat White (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Flat White (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Steam milk with a thin foam layer.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Flat White (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Flat White (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Steam milk with a thin foam layer.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Flat White (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Flat White (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a double shot of espresso into the cup.'),
  (2, 'Steam milk with a thin foam layer.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Latte (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Latte (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Steam milk with a light foam layer, about 1cm.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Latte (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Latte (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Steam milk with a light foam layer, about 1cm.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Latte (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Latte (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a double shot of espresso into the cup.'),
  (2, 'Steam milk with a light foam layer, about 1cm.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Cappuccino (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Cappuccino (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Steam milk with extra foam.'),
  (3, 'Pour the steamed milk and foam over the espresso.'),
  (4, 'Dust with chocolate powder on top.')
) AS s(n, txt);

-- Cappuccino (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Cappuccino (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Steam milk with extra foam.'),
  (3, 'Pour the steamed milk and foam over the espresso.'),
  (4, 'Dust with chocolate powder on top.')
) AS s(n, txt);

-- Cappuccino (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Cappuccino (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a double shot of espresso into the cup.'),
  (2, 'Steam milk with extra foam.'),
  (3, 'Pour the steamed milk and foam over the espresso.'),
  (4, 'Dust with chocolate powder on top.')
) AS s(n, txt);

-- Long Black (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Long Black (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add hot water to the cup, with a small dash of cold water to protect the crema.'),
  (2, 'Pull a double shot of espresso and pour on top.')
) AS s(n, txt);

-- Long Black (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Long Black (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add hot water to the cup, with a small dash of cold water to protect the crema.'),
  (2, 'Pull a double shot of espresso and pour on top.')
) AS s(n, txt);

-- Long Black (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Long Black (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add hot water to the cup, with a small dash of cold water to protect the crema.'),
  (2, 'Pull a double shot of espresso and pour on top.')
) AS s(n, txt);

-- Piccolo
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Piccolo' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into a 4oz cup.'),
  (2, 'Top with steamed milk.')
) AS s(n, txt);

-- Espresso
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Espresso' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso.'),
  (2, 'Ask the customer if they''d like a lid.')
) AS s(n, txt);

-- Macchiato
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Macchiato' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into the cup.'),
  (2, 'Add a small dollop of steamed milk foam on top to "stain" the espresso.')
) AS s(n, txt);

-- Short Black
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Short Black' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a single shot of espresso into a small cup.'),
  (2, 'Serve neat -- no milk or water added.')
) AS s(n, txt);

-- Magic
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Magic' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Pull a double shot of espresso into the cup.'),
  (2, 'Steam a small amount of milk (about 100ml) to a fine, silky microfoam.'),
  (3, 'Pour the steamed milk over the espresso.')
) AS s(n, txt);

-- Mocha (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Mocha (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add drinking chocolate powder to the cup.'),
  (2, 'Pull a single shot of espresso and mix through the chocolate.'),
  (3, 'Steam milk and pour over the mixture.'),
  (4, 'Top with a dusting of chocolate powder.')
) AS s(n, txt);

-- Mocha (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Mocha (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add drinking chocolate powder to the cup.'),
  (2, 'Pull a single shot of espresso and mix through the chocolate.'),
  (3, 'Steam milk and pour over the mixture.'),
  (4, 'Top with a dusting of chocolate powder.')
) AS s(n, txt);

-- Mocha (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Mocha (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add drinking chocolate powder to the cup.'),
  (2, 'Pull a double shot of espresso and mix through the chocolate.'),
  (3, 'Steam milk and pour over the mixture.'),
  (4, 'Top with a dusting of chocolate powder.')
) AS s(n, txt);

-- Matcha Latte (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Matcha Latte (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Whisk the matcha powder with a small amount of hot water until smooth.'),
  (2, 'Add agave syrup if the customer requests it.'),
  (3, 'Steam milk and pour over the matcha mix.'),
  (4, 'Top with a dusting of cinnamon sugar.')
) AS s(n, txt);

-- Matcha Latte (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Matcha Latte (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Whisk the matcha powder with a small amount of hot water until smooth.'),
  (2, 'Add agave syrup if the customer requests it.'),
  (3, 'Steam milk and pour over the matcha mix.'),
  (4, 'Top with a dusting of cinnamon sugar.')
) AS s(n, txt);

-- Matcha Latte (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Matcha Latte (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Whisk the matcha powder with a small amount of hot water until smooth.'),
  (2, 'Add agave syrup if the customer requests it.'),
  (3, 'Steam milk and pour over the matcha mix.'),
  (4, 'Top with a dusting of cinnamon sugar.')
) AS s(n, txt);

-- Chai Latte (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Chai Latte (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add the chai concentrate to the cup.'),
  (2, 'Steam milk and pour over the chai concentrate.'),
  (3, 'Top with a dusting of cinnamon sugar.')
) AS s(n, txt);

-- Chai Latte (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Chai Latte (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add the chai concentrate to the cup.'),
  (2, 'Steam milk and pour over the chai concentrate.'),
  (3, 'Top with a dusting of cinnamon sugar.')
) AS s(n, txt);

-- Chai Latte (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Chai Latte (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add the chai concentrate to the cup.'),
  (2, 'Steam milk and pour over the chai concentrate.'),
  (3, 'Top with a dusting of cinnamon sugar.')
) AS s(n, txt);

-- Hot Chocolate (Small)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Hot Chocolate (Small)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add drinking chocolate powder to the cup.'),
  (2, 'Steam milk and pour over the chocolate powder, stirring until dissolved.'),
  (3, 'Top with a dusting of chocolate powder.')
) AS s(n, txt);

-- Hot Chocolate (Medium)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Hot Chocolate (Medium)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add drinking chocolate powder to the cup.'),
  (2, 'Steam milk and pour over the chocolate powder, stirring until dissolved.'),
  (3, 'Top with a dusting of chocolate powder.')
) AS s(n, txt);

-- Hot Chocolate (Large)
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Hot Chocolate (Large)' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add chocolate powder to the cup.'),
  (2, 'Steam milk and pour over the chocolate powder, stirring until dissolved.'),
  (3, 'Top with a dusting of chocolate powder.')
) AS s(n, txt);

-- Babyccino
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Babyccino' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Steam milk to a warm, drinkable temperature with a good amount of foam.'),
  (2, 'Pour into a 4oz cup.'),
  (3, 'Dust with chocolate powder on top.')
) AS s(n, txt);

-- English Breakfast Tea
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'English Breakfast Tea' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add an English Breakfast tea bag to the cup.'),
  (2, 'Fill with hot water.'),
  (3, 'Steep for 3-4 minutes, then remove the tea bag.')
) AS s(n, txt);

-- Green Tea
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Green Tea' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add a Green Tea bag to the cup.'),
  (2, 'Fill with hot water just off the boil.'),
  (3, 'Steep for 2-3 minutes, then remove the tea bag.')
) AS s(n, txt);

-- Iced Milo
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Milo' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add a scoop of Milo to the bottom of the cup.'),
  (2, 'Fill the cup with ice.'),
  (3, 'In a small jug, mix 2 large scoops of Milo with the customer''s milk of choice, stirring until dissolved.'),
  (4, 'Pour over the ice.'),
  (5, 'Sprinkle Milo on top.')
) AS s(n, txt);

-- Iced Strawberry
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Strawberry' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Line the cup with strawberry puree, up to the first indent.'),
  (2, 'Fill the cup with ice.'),
  (3, 'Add the customer''s milk of choice.'),
  (4, 'Sprinkle cinnamon sugar on top.')
) AS s(n, txt);

-- Iced Latte
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Latte' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Fill the cup with ice and milk.'),
  (2, 'Add a double shot of espresso on top.')
) AS s(n, txt);

-- Iced Long Black
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Long Black' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Fill the cup with ice and water.'),
  (2, 'Add a double shot of espresso on top.')
) AS s(n, txt);

-- Iced Mocha
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Mocha' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Line the cup with chocolate syrup.'),
  (2, 'Pull a double shot of espresso and mix with the chocolate syrup.'),
  (3, 'Fill the cup with ice and milk.'),
  (4, 'Add the espresso/chocolate mix.'),
  (5, 'Top with chocolate powder.')
) AS s(n, txt);

-- Iced Chai
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Chai' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Mix the chai concentrate with a small amount of hot water.'),
  (2, 'Fill the cup with ice and milk.'),
  (3, 'Add the chai mix.'),
  (4, 'Top with cinnamon sugar.')
) AS s(n, txt);

-- Iced Matcha
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Matcha' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Ask if the customer wants agave syrup (recommend a little).'),
  (2, 'Whisk 1.5 heaped scoops of matcha with the agave.'),
  (3, 'Fill the cup with ice and milk.'),
  (4, 'Add the matcha mix.')
) AS s(n, txt);

-- Iced Strawberry Matcha
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Strawberry Matcha' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Line the cup with strawberry puree, up to the first indent.'),
  (2, 'Fill the cup with ice.'),
  (3, 'Whisk 1.5 heaped scoops of matcha.'),
  (4, 'Fill with ice and milk.'),
  (5, 'Add the matcha mix.')
) AS s(n, txt);

-- Iced Milo Mocha
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Milo Mocha' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add a scoop of Milo to the bottom of the cup.'),
  (2, 'Fill the cup with ice.'),
  (3, 'Pull a shot of espresso and mix with chocolate syrup.'),
  (4, 'In a small jug, mix 2 large scoops of Milo with the customer''s milk of choice and the espresso/chocolate mix.'),
  (5, 'Pour over the ice.'),
  (6, 'Sprinkle Milo on top.')
) AS s(n, txt);

-- Iced Chocolate
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Chocolate' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Line the cup with chocolate syrup.'),
  (2, 'Fill the cup with ice and milk.'),
  (3, 'Stir to combine the chocolate through the milk.'),
  (4, 'Top with chocolate powder.')
) AS s(n, txt);

-- Iced Banana
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Iced Banana' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Add banana puree to the bottom of the cup.'),
  (2, 'Fill the cup with ice.'),
  (3, 'Add the customer''s milk of choice.'),
  (4, 'Stir to combine.')
) AS s(n, txt);

-- Banana Iced Latte
WITH item AS (
  SELECT id, org_id FROM production_items WHERE name = 'Banana Iced Latte' AND category = 'Coffee & Tea' AND active IS NOT FALSE LIMIT 1
), g AS (
  INSERT INTO drink_guides (org_id, production_item_id, version, active)
  SELECT org_id, id, 1, true FROM item
  RETURNING id, org_id
)
INSERT INTO drink_guide_steps (org_id, guide_id, step_number, instruction_text)
SELECT g.org_id, g.id, s.n, s.txt FROM g, (VALUES
  (1, 'Fill the cup with ice and milk.'),
  (2, 'Add a double shot of espresso.'),
  (3, 'Top with banana cold foam.')
) AS s(n, txt);
