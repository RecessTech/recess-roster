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

    // Drinks Guide only covers Coffee & Tea -- read-only reference data,
    // nothing time- or day-scoped like the other public views.
    const { data: items } = await supabase
      .from('production_items')
      .select('id, name, category, active')
      .eq('org_id', org.id)
      .eq('category', 'Coffee & Tea')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    const activeItems = (items || []).filter((i: any) => i.active !== false);
    const itemIds = activeItems.map((i: any) => i.id);

    const { data: guideRows } = itemIds.length
      ? await supabase
          .from('drink_guides')
          .select('id, production_item_id, version')
          .eq('org_id', org.id)
          .eq('active', true)
          .in('production_item_id', itemIds)
      : { data: [] };

    const guideIds = (guideRows || []).map((g: any) => g.id);

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
    const { data: lineRows } = itemIds.length
      ? await supabase
          .from('recipe_menu_item_lines')
          .select('item_id, stock_item_id, component_id, qty, sort_order')
          .eq('org_id', org.id)
          .in('item_id', itemIds)
          .neq('is_packaging', true)
          .order('sort_order', { ascending: true })
      : { data: [] };

    const stockItemIds = [...new Set((lineRows || []).map((l: any) => l.stock_item_id).filter(Boolean))];
    const componentIds = [...new Set((lineRows || []).map((l: any) => l.component_id).filter(Boolean))];

    const { data: stockRows } = stockItemIds.length
      ? await supabase.from('stock_items').select('id, name, uom').in('id', stockItemIds)
      : { data: [] };
    const { data: componentRows } = componentIds.length
      ? await supabase.from('recipe_components').select('id, name, uom').in('id', componentIds)
      : { data: [] };

    const skuById = new Map((stockRows || []).map((s: any) => [s.id, s]));
    const componentById = new Map((componentRows || []).map((c: any) => [c.id, c]));

    const ingredients: Record<string, any[]> = {};
    (lineRows || []).forEach((l: any) => {
      const source = l.stock_item_id ? skuById.get(l.stock_item_id) : componentById.get(l.component_id);
      if (!ingredients[l.item_id]) ingredients[l.item_id] = [];
      ingredients[l.item_id].push({ name: source?.name ?? 'Unknown', qty: l.qty, uom: source?.uom ?? '' });
    });

    const guideById = new Map((guideRows || []).map((g: any) => [g.id, g]));
    const guides: Record<string, any> = {};
    (guideRows || []).forEach((g: any) => {
      guides[g.production_item_id] = { version: g.version, steps: [] };
    });
    (stepRows || []).forEach((s: any) => {
      const guide = guideById.get(s.guide_id);
      if (!guide) return;
      const entry = guides[guide.production_item_id];
      if (entry) entry.steps.push({ step_number: s.step_number, instruction_text: s.instruction_text });
    });

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Drinks Guide',
      items: activeItems,
      guides,
      ingredients,
    });

  } catch (err) {
    console.error('public-barista error:', err);
    return jsonResponse({ error: String(err) });
  }
});
