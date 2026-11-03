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
    const { token, action } = body;
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);

    // This function runs with the service role, so it bypasses RLS --
    // every write below re-checks org_id itself rather than trusting the
    // client, since nothing else stands between a caller and the database.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Same single staff-surface public token as the rest of Staff Hub.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    let submitResult: { updated: number; skipped: number } | null = null;

    if (action === 'submit') {
      const { locationId, name, entries } = body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return jsonResponse({ error: 'Nothing to submit.' }, 400);
      }

      const { data: loc } = await supabase.from('locations').select('id').eq('id', locationId).eq('org_id', org.id).single();
      if (!loc) return jsonResponse({ error: 'Unknown site.' }, 400);

      let updated = 0;
      let skipped = 0;
      // One update per entry rather than a single bulk statement -- each
      // row needs a different value, and this list is a ~25-item
      // checklist, not a bulk import, so per-row round trips are fine.
      for (const entry of entries) {
        const { itemId, level } = entry || {};
        if (!itemId || (level !== 'ok' && level !== 'low' && level !== 'order_soon')) { skipped++; continue; }

        const { data: siteRow } = await supabase.from('stock_item_sites').select('id').eq('item_id', itemId).eq('location_id', locationId).eq('org_id', org.id).single();
        if (!siteRow) { skipped++; continue; }

        const isOk = level === 'ok';
        const { error: updateError } = await supabase.from('stock_item_sites').update({
          staff_flag_level: isOk ? null : level,
          staff_flagged_at: isOk ? null : new Date().toISOString(),
          staff_flagged_by_name: isOk ? null : ((name || '').trim() || null),
          updated_at: new Date().toISOString(),
        }).eq('id', siteRow.id);

        if (updateError) { skipped++; continue; }
        updated++;
      }

      submitResult = { updated, skipped };
    }

    // Load the checklist config -- businessName, sites, and every active
    // group with its ordered SKU list, plus which (item, location) pairs
    // are actually carried where (a group's SKU might not be carried at
    // every site) and each one's current flag, if any, so the checklist
    // can show "already flagged" context. Always returned, including
    // after a submit, so the client's `data` stays a consistent shape --
    // it unconditionally re-reads data.groups/data.siteRows every render.
    const [{ data: locations }, { data: groups }, { data: siteRows }, { data: allItems }] = await Promise.all([
      supabase.from('locations').select('id, name').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('sku_groups')
        .select('id, name, sort_order, sku_group_items(item_id, sort_order, stock_items(id, name, sku, uom, active))')
        .eq('org_id', org.id)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('stock_item_sites').select('item_id, location_id, staff_flag_level, staff_flagged_at, staff_flagged_by_name').eq('org_id', org.id),
      // Every active SKU, not just the ones curated into a group -- lets
      // staff search for and flag any item carried at their site, not only
      // what an admin has already put on a list. Small payload (a couple
      // hundred rows of id/name/sku/uom), so one flat list is simplest.
      supabase.from('stock_items').select('id, name, sku, uom').eq('org_id', org.id).eq('active', true).order('name'),
    ]);

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    const cleanGroups = (groups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      items: (g.sku_group_items || [])
        .filter((gi: any) => gi.stock_items && gi.stock_items.active)
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((gi: any) => ({ id: gi.stock_items.id, name: gi.stock_items.name, sku: gi.stock_items.sku, uom: gi.stock_items.uom })),
    })).filter((g: any) => g.items.length > 0);

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Stock Check',
      locations: locations || [],
      groups: cleanGroups,
      siteRows: siteRows || [],
      items: allItems || [],
      ...(submitResult ? { success: true, ...submitResult } : {}),
    });

  } catch (err) {
    console.error('public-stock-check error:', err);
    return jsonResponse({ error: String(err) });
  }
});
