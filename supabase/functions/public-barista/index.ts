import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token } = body;
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Same single staff-surface public token as Staff Hub, R-Prod, Transfer
    // Hub, Prep List, Catering and R-Builds -- one link to distribute and
    // regenerate.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    // The Drinks Guide has two kinds of subject, grouped into sections:
    // Coffee & Tea menu items (served as-is, fixed per drink) and
    // recipe_components carrying a category (e.g. 'Cold Foam' batch
    // preps, scaled to whatever yield staff enter on the client). Every
    // subject is addressed by a "kind:id" key throughout this response
    // so the two id spaces (production_items vs recipe_components)
    // never collide.
    const { data: items } = await supabase
      .from('production_items')
      .select('id, name, category, active, sort_order')
      .eq('org_id', org.id)
      .eq('category', 'Coffee & Tea')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    const { data: comps } = await supabase
      .from('recipe_components')
      .select('id, name, category, active, uom, batch_yield, sort_order')
      .eq('org_id', org.id)
      .not('category', 'is', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    const activeItems = (items || []).filter((i: any) => i.active !== false);
    const activeComps = (comps || []).filter((c: any) => c.active !== false);
    const itemIds = activeItems.map((i: any) => i.id);
    const compIds = activeComps.map((c: any) => c.id);

    const [{ data: itemGuideRows }, { data: compGuideRows }] = await Promise.all([
      itemIds.length
        ? supabase.from('drink_guides').select('id, production_item_id, version').eq('org_id', org.id).eq('active', true).in('production_item_id', itemIds)
        : Promise.resolve({ data: [] as any[] }),
      compIds.length
        ? supabase.from('drink_guides').select('id, component_id, version').eq('org_id', org.id).eq('active', true).in('component_id', compIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const guideRows = [...(itemGuideRows || []), ...(compGuideRows || [])];
    const guideIds = guideRows.map((g: any) => g.id);

    const { data: stepRows } = guideIds.length
      ? await supabase
          .from('drink_guide_steps')
          .select('guide_id, step_number, instruction_text')
          .eq('org_id', org.id)
          .in('guide_id', guideIds)
          .order('step_number', { ascending: true })
      : { data: [] };

    // Ingredients are never stored on the guide -- always read live from
    // R-Recipe so a recipe change here never leaves the guide stale.
    const [{ data: menuLineRows }, { data: compLineRows }] = await Promise.all([
      itemIds.length
        ? supabase.from('recipe_menu_item_lines').select('item_id, stock_item_id, component_id, qty, sort_order').eq('org_id', org.id).in('item_id', itemIds).neq('is_packaging', true).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      compIds.length
        ? supabase.from('recipe_component_lines').select('component_id, stock_item_id, sub_component_id, qty, sort_order').eq('org_id', org.id).in('component_id', compIds).order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const stockItemIds = [...new Set([
      ...(menuLineRows || []).map((l: any) => l.stock_item_id),
      ...(compLineRows || []).map((l: any) => l.stock_item_id),
    ].filter(Boolean))];
    const subComponentIds = [...new Set([
      ...(menuLineRows || []).map((l: any) => l.component_id),
      ...(compLineRows || []).map((l: any) => l.sub_component_id),
    ].filter(Boolean))];

    const [{ data: stockRows }, { data: subComponentRows }] = await Promise.all([
      stockItemIds.length ? supabase.from('stock_items').select('id, name, uom').in('id', stockItemIds) : Promise.resolve({ data: [] as any[] }),
      subComponentIds.length ? supabase.from('recipe_components').select('id, name, uom').in('id', subComponentIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const skuById = new Map((stockRows || []).map((s: any) => [s.id, s]));
    const subComponentById = new Map((subComponentRows || []).map((c: any) => [c.id, c]));

    const ingredients: Record<string, any[]> = {};
    (menuLineRows || []).forEach((l: any) => {
      const source = l.stock_item_id ? skuById.get(l.stock_item_id) : subComponentById.get(l.component_id);
      const key = `item:${l.item_id}`;
      if (!ingredients[key]) ingredients[key] = [];
      ingredients[key].push({ name: source?.name ?? 'Unknown', qty: l.qty, uom: source?.uom ?? '' });
    });
    (compLineRows || []).forEach((l: any) => {
      const source = l.stock_item_id ? skuById.get(l.stock_item_id) : subComponentById.get(l.sub_component_id);
      const key = `component:${l.component_id}`;
      if (!ingredients[key]) ingredients[key] = [];
      ingredients[key].push({ name: source?.name ?? 'Unknown', qty: l.qty, uom: source?.uom ?? '' });
    });

    const guideById = new Map(guideRows.map((g: any) => [g.id, g]));
    const guides: Record<string, any> = {};
    (itemGuideRows || []).forEach((g: any) => { guides[`item:${g.production_item_id}`] = { version: g.version, steps: [] }; });
    (compGuideRows || []).forEach((g: any) => { guides[`component:${g.component_id}`] = { version: g.version, steps: [] }; });
    (stepRows || []).forEach((s: any) => {
      const g = guideById.get(s.guide_id);
      if (!g) return;
      const key = g.production_item_id ? `item:${g.production_item_id}` : `component:${g.component_id}`;
      const entry = guides[key];
      if (entry) entry.steps.push({ step_number: s.step_number, instruction_text: s.instruction_text });
    });

    const sections = [
      {
        category: 'Coffee & Tea',
        items: activeItems.map((i: any) => ({ id: i.id, key: `item:${i.id}`, kind: 'item', name: i.name })),
      },
      ...Object.entries(
        activeComps.reduce((acc: Record<string, any[]>, c: any) => {
          (acc[c.category] ||= []).push(c);
          return acc;
        }, {})
      ).map(([category, comps]) => ({
        category,
        items: (comps as any[]).map(c => ({
          id: c.id, key: `component:${c.id}`, kind: 'component', name: c.name,
          batchYield: c.batch_yield, uom: c.uom,
        })),
      })),
    ].filter(section => section.items.length > 0);

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Drinks Guide',
      sections,
      guides,
      ingredients,
    });

  } catch (err) {
    console.error('public-barista error:', err);
    return jsonResponse({ error: String(err) });
  }
});
