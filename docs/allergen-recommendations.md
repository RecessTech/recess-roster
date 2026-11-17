# Allergen recommendations

Applied by `supabase_menu_allergens_recommendations.sql`. Everything below is a **draft**: it shows in the app as "Draft - unverified". Where something couldn't be checked, the uncertain allergen is listed as *may be present*, never left out.

## Biggest things to check first (they affect many items)

| Check | Why | Items affected |
|---|---|---|
| **Chilli crisp label** | Usually soy + sesame, sometimes peanut | El Diablo, Chilli Turk, Triple C |
| **Balsamic vinegar / glaze** | Commonly has sulphites (>= 10mg/kg) | Super Green, Veg & Grains, Chilli Turk, Roast Beef & Onion |
| **Vegan mayo** | Often soy- or chickpea-based | Super Green |
| **Muesli** | Oats/wheat, often nuts, seeds, milk powder | Yoghurt Cup, Mango Chia Pudding |
| **Chai powder, choc powder, Milo, syrups** | Milk and soy are common | Chai, Hot Chocolate, Mocha, Milo drinks |
| **Peanut products on site** | Bounce Peanut balls and Whittakers Peanut Slab are in stock; the rubric's "may be present" never mentions peanut | Staff will get peanut questions - decide the shared-site wording |

## Rubric corrections already made (added allergen, never removed)

BLT +milk, Curried Egg +milk, Chicken Caesar +egg, Banana Bread +sesame, Almond Croissant +almond.

## Recommendations by group

**Toasties / salads (from sibling items or standard recipes)**
- Ham, Cheese & Tomato Toastie: wheat, gluten, milk (same as rubric Ham, Cheese & Pickle). *Good confidence.*
- Veg Toastie: wheat, gluten, milk; may egg/soy/sesame. *Needs the real filling.*
- Birria Toastie: wheat, gluten, milk; may sulphites/soy. *Needs the recipe.*
- Tikka Salad: milk (yoghurt marinade); may gluten, soy, sesame, egg, mustard, almond, cashew. *Check tikka paste.*
- Mango Chia Pudding: gluten (muesli); may nuts/sesame/milk/soy. Coconut is not a declarable allergen in AU.

**Bakery**
- Portuguese Tart: wheat, gluten, egg, milk. *Get supplier spec.*
- Butterboy cookies: all wheat, gluten, egg, milk, plus Bueno and Nutella = hazelnut + soy; Salted Caramel may have macadamia. **No official Butterboy spec was found online - ask Butterboy.** Monthly Special needs its inclusions added each month.

**Soups (no recipes in R-Recipe, so assumptions)**
- Chicken Noodle: wheat, gluten (noodles); may egg/soy/milk.
- Tomato, Red Lentil, Split Pea: nothing certain; may milk/gluten/soy (stock, cream, butter).
- Thai Pumpkin: may crustacea + fish (curry paste / fish sauce), soy, gluten.
- Best fix: build these as recipes in R-Recipe so allergens can be derived.

**Coffee & Tea (47 items)**
- Black coffee/tea (Espresso, Short/Long Black, Cold Brew, English Breakfast, Green Tea): no allergens.
- Everything else: contains milk (full-cream default). Alternative milks are shown as *may be present*: soy milk = soy, almond milk = almond, oat milk = gluten (oats). Milo drinks also contain gluten (barley malt).

**Packaged**
- Killer Python: wheat, gluten; may contain milk - matches Allen's retailer listings.
- Coke / Coke No Sugar / Diet Coke / waters / Almighty juices / Bobby Soda / Almighty Sparkling / Dear San: no declared allergens expected (Dear San's description is coconut water + matcha only).
- Mateo Mate Soda and Samboys: **couldn't find a label online** - check the packs.
- Mecca beans: none.
- TGTG Surprise Bag: contents vary, so every common allergen is listed as *may be present*.

## Still blank (shown as "Not recorded")

- **Protein Add-On** - what is the protein?
- **Dave's One** - what is in it?
