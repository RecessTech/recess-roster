-- ============================================================
-- Drinks packaging mass-update (already applied directly to the
-- live project via the Supabase MCP -- this file just records
-- the change for history).
--
-- Rules applied across every "Coffee & Tea" recipe:
-- 1) Any item with (Large)/(Medium)/(Small) in its name gets the
--    matching coffee cup (Large Coffee Cups (10oz) / Medium
--    Coffee Cups (8oz) / Small Coffee Cups (6oz)) plus an
--    8oz Coffee Lid -- all three sizes share the same lid.
-- 2) Any item with "Iced" in its name gets Iced Cups, Iced Lids,
--    a Straw, and 210ml of Ice added to its recipe.
--
-- Idempotent: every insert is guarded by NOT EXISTS, so items
-- that already had some or all of these lines (Hot Chocolate
-- (Large), all three Long Black sizes, Banana Iced Latte, and
-- partial packaging on Iced Banana / Iced Latte / Iced Long
-- Black) were left alone -- only what was actually missing got
-- added.
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_large_cup uuid;
  v_medium_cup uuid;
  v_small_cup uuid;
  v_8oz_lid uuid;
  v_iced_cup uuid;
  v_iced_lid uuid;
  v_straw uuid;
  v_ice uuid;
begin
  select id into v_org_id from organisations where name = 'It''s Recess';
  select id into v_large_cup from stock_items where org_id = v_org_id and name = 'Large Coffee Cups (10oz)';
  select id into v_medium_cup from stock_items where org_id = v_org_id and name = 'Medium Coffee Cups (8oz)';
  select id into v_small_cup from stock_items where org_id = v_org_id and name = 'Small Coffee Cups (6oz)';
  select id into v_8oz_lid from stock_items where org_id = v_org_id and name = '8oz Coffee Lid';
  select id into v_iced_cup from stock_items where org_id = v_org_id and name = 'Iced Cups';
  select id into v_iced_lid from stock_items where org_id = v_org_id and name = 'Iced Lids';
  select id into v_straw from stock_items where org_id = v_org_id and name = 'Straws';
  select id into v_ice from stock_items where org_id = v_org_id and name = 'Ice';

  -- 1a) size-matched cup
  insert into recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
  select v_org_id, pi.id,
    case
      when pi.name ilike '%(large)%' then v_large_cup
      when pi.name ilike '%(medium)%' then v_medium_cup
      when pi.name ilike '%(small)%' then v_small_cup
    end,
    1,
    coalesce((select max(sort_order) from recipe_menu_item_lines where item_id = pi.id), -1) + 1,
    true
  from production_items pi
  where pi.org_id = v_org_id
    and pi.category = 'Coffee & Tea'
    and (pi.name ilike '%(large)%' or pi.name ilike '%(medium)%' or pi.name ilike '%(small)%')
    and not exists (
      select 1 from recipe_menu_item_lines ml
      where ml.item_id = pi.id
        and ml.stock_item_id = case
          when pi.name ilike '%(large)%' then v_large_cup
          when pi.name ilike '%(medium)%' then v_medium_cup
          when pi.name ilike '%(small)%' then v_small_cup
        end
    );

  -- 1b) 8oz lid, shared by all three sizes
  insert into recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
  select v_org_id, pi.id, v_8oz_lid, 1,
    coalesce((select max(sort_order) from recipe_menu_item_lines where item_id = pi.id), -1) + 1,
    true
  from production_items pi
  where pi.org_id = v_org_id
    and pi.category = 'Coffee & Tea'
    and (pi.name ilike '%(large)%' or pi.name ilike '%(medium)%' or pi.name ilike '%(small)%')
    and not exists (
      select 1 from recipe_menu_item_lines ml
      where ml.item_id = pi.id and ml.stock_item_id = v_8oz_lid
    );

  -- 2a) Iced Cups
  insert into recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
  select v_org_id, pi.id, v_iced_cup, 1,
    coalesce((select max(sort_order) from recipe_menu_item_lines where item_id = pi.id), -1) + 1,
    true
  from production_items pi
  where pi.org_id = v_org_id
    and pi.category = 'Coffee & Tea'
    and pi.name ilike '%iced%'
    and not exists (
      select 1 from recipe_menu_item_lines ml
      where ml.item_id = pi.id and ml.stock_item_id = v_iced_cup
    );

  -- 2b) Iced Lids
  insert into recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
  select v_org_id, pi.id, v_iced_lid, 1,
    coalesce((select max(sort_order) from recipe_menu_item_lines where item_id = pi.id), -1) + 1,
    true
  from production_items pi
  where pi.org_id = v_org_id
    and pi.category = 'Coffee & Tea'
    and pi.name ilike '%iced%'
    and not exists (
      select 1 from recipe_menu_item_lines ml
      where ml.item_id = pi.id and ml.stock_item_id = v_iced_lid
    );

  -- 2c) Straws
  insert into recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
  select v_org_id, pi.id, v_straw, 1,
    coalesce((select max(sort_order) from recipe_menu_item_lines where item_id = pi.id), -1) + 1,
    true
  from production_items pi
  where pi.org_id = v_org_id
    and pi.category = 'Coffee & Tea'
    and pi.name ilike '%iced%'
    and not exists (
      select 1 from recipe_menu_item_lines ml
      where ml.item_id = pi.id and ml.stock_item_id = v_straw
    );

  -- 2d) Ice (an ingredient, not packaging -- matches the convention already
  -- used on Iced Banana / Banana Iced Latte)
  insert into recipe_menu_item_lines (org_id, item_id, stock_item_id, qty, sort_order, is_packaging)
  select v_org_id, pi.id, v_ice, 210,
    coalesce((select max(sort_order) from recipe_menu_item_lines where item_id = pi.id), -1) + 1,
    false
  from production_items pi
  where pi.org_id = v_org_id
    and pi.category = 'Coffee & Tea'
    and pi.name ilike '%iced%'
    and not exists (
      select 1 from recipe_menu_item_lines ml
      where ml.item_id = pi.id and ml.stock_item_id = v_ice
    );
end $$;
