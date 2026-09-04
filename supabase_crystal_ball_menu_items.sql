-- ============================================================
-- Crystal Ball: create the 106 real menu items found in the
-- POS sales/modifier export (coffee sizes split into their own
-- items, bakery/soups/full drinks list added). Safe to run more
-- than once -- skips any name that already exists in the catalog.
-- ============================================================

INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Juice - Apple', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Juice - Apple');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Juice - Apple, Blackcurrant & Boysenberry', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Juice - Apple, Blackcurrant & Boysenberry');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Juice - Apple, Guava & Lime', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Juice - Apple, Guava & Lime');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Juice - Carrot, Orange & Turmeric', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Juice - Carrot, Orange & Turmeric');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Juice - Orange', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Juice - Orange');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Juice - Orange, Apple & Mango', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Juice - Orange, Apple & Mango');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almighty Sparkling - Blood Orange', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almighty Sparkling - Blood Orange');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Almond Croissant', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Almond Croissant');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'B&E Toastie', 'Breakfast', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'B&E Toastie');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'BLT', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'BLT');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Babyccino', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Babyccino');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Banana Bread', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Banana Bread');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Banana Iced Latte', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Banana Iced Latte');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Birria Toastie', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Birria Toastie');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Bobby Soda - Ginger Beer', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Bobby Soda - Ginger Beer');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Bobby Soda - Passionfruit', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Bobby Soda - Passionfruit');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Butterboy Cookie - Bueno', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Butterboy Cookie - Bueno');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Butterboy Cookie - Milk Choc Chip', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Butterboy Cookie - Milk Choc Chip');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Butterboy Cookie - Nutella Choc Chip', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Butterboy Cookie - Nutella Choc Chip');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Butterboy Cookie - Salted Caramel', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Butterboy Cookie - Salted Caramel');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Butterboy Cookie - Snickerdoodle', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Butterboy Cookie - Snickerdoodle');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Cappuccino (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Cappuccino (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Cappuccino (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Cappuccino (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Cappuccino (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Cappuccino (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chai Latte (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chai Latte (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chai Latte (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chai Latte (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chai Latte (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chai Latte (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Cheese Toastie', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Cheese Toastie');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chicken & Greens', 'Salads', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chicken & Greens');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chicken Avo', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chicken Avo');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chicken Caesar', 'Salads', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chicken Caesar');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chicken Noodle Soup', 'Soups', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chicken Noodle Soup');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chickpea Smash', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chickpea Smash');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chilli Turk', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chilli Turk');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Chocolate Croissant', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Chocolate Croissant');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Coke', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Coke');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Coke No Sugar', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Coke No Sugar');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Curried Egg', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Curried Egg');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Dave''s One', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Dave''s One');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Dear San - Matcha Coconut Water', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Dear San - Matcha Coconut Water');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Diet Coke', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Diet Coke');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'El Diablo', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'El Diablo');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'English Breakfast Tea', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'English Breakfast Tea');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Espresso', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Espresso');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Flat White (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Flat White (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Flat White (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Flat White (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Flat White (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Flat White (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Green Tea', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Green Tea');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Ham & Cheese Croissant', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Ham & Cheese Croissant');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Ham, Cheese & Pickle', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Ham, Cheese & Pickle');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Ham, Cheese & Tomato Toastie', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Ham, Cheese & Tomato Toastie');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Hot Chocolate (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Hot Chocolate (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Hot Chocolate (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Hot Chocolate (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Hot Chocolate (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Hot Chocolate (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Banana', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Banana');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Chai', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Chai');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Chocolate', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Chocolate');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Latte', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Latte');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Long Black', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Long Black');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Matcha', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Matcha');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Milo', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Milo');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Milo Mocha', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Milo Mocha');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Mocha', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Mocha');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Strawberry', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Strawberry');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Iced Strawberry Matcha', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Iced Strawberry Matcha');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Killer Python', 'Snacks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Killer Python');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Latte (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Latte (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Latte (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Latte (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Latte (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Latte (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Long Black (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Long Black (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Long Black (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Long Black (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Long Black (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Long Black (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Macchiato', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Macchiato');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Magic', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Magic');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Mango Chia Pudding', 'Breakfast', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mango Chia Pudding');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Matcha Latte (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Matcha Latte (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Matcha Latte (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Matcha Latte (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Matcha Latte (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Matcha Latte (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Mateo Mate Soda', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mateo Mate Soda');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Mocha (Large)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mocha (Large)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Mocha (Medium)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mocha (Medium)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Mocha (Small)', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mocha (Small)');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Mushroom & Egg', 'Breakfast', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Mushroom & Egg');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Pastrami', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Pastrami');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Pesto Chook', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Pesto Chook');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Piccolo', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Piccolo');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Portuguese Tart', 'Bakery', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Portuguese Tart');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Recess Club', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Recess Club');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Red Lentil Soup', 'Soups', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Red Lentil Soup');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Roast Beef & Onion', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Roast Beef & Onion');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Samboys', 'Snacks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Samboys');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Short Black', 'Coffee & Tea', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Short Black');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Sparkling Water', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Sparkling Water');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Split Pea Soup', 'Soups', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Split Pea Soup');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Super Green', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Super Green');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Thai Pumpkin Soup', 'Soups', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Thai Pumpkin Soup');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'The Big Tuna', 'Sandwiches', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'The Big Tuna');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Toast', 'Breakfast', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Toast');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Tomato & Cheese', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Tomato & Cheese');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Tomato Soup', 'Soups', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Tomato Soup');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Triple C', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Triple C');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Tuna Melt', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Tuna Melt');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Veg & Grains', 'Salads', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Veg & Grains');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Veg Toastie', 'Toasties', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Veg Toastie');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Water Bottle', 'Drinks', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Water Bottle');
INSERT INTO production_items (org_id, name, category, active)
  SELECT (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1), 'Yoghurt Cup', 'Breakfast', true
  WHERE NOT EXISTS (SELECT 1 FROM production_items WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1) AND name = 'Yoghurt Cup');

-- ── VERIFY ─────────────────────────────────────────────────────
SELECT category, count(*) FROM production_items
WHERE org_id = (SELECT org_id FROM production_sites WHERE name = 'Bus Stop' LIMIT 1)
GROUP BY category ORDER BY category;
