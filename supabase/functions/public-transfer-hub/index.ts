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

    // Look up org by the single staff-surface public token -- Staff Hub,
    // the production plan, and Transfer Hub all now share one token, so
    // there's exactly one link to distribute and regenerate.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    if (action === 'create') {
      const { itemId, componentId, locationId, quantity, quantityUnit, priority, note, name } = body;

      if ((!!itemId) === (!!componentId)) {
        return jsonResponse({ error: 'Pick exactly one SKU or component.' }, 400);
      }
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return jsonResponse({ error: 'Enter a quantity greater than 0.' }, 400);
      }

      const { data: loc } = await supabase.from('locations').select('id').eq('id', locationId).eq('org_id', org.id).single();
      if (!loc) return jsonResponse({ error: 'Unknown site.' }, 400);

      if (itemId) {
        const { data: item } = await supabase.from('stock_items').select('id').eq('id', itemId).eq('org_id', org.id).single();
        if (!item) return jsonResponse({ error: 'Unknown SKU.' }, 400);
      } else {
        const { data: comp } = await supabase.from('recipe_components').select('id').eq('id', componentId).eq('org_id', org.id).single();
        if (!comp) return jsonResponse({ error: 'Unknown component.' }, 400);
      }

      const { error: insertError } = await supabase.from('transfer_requests').insert([{
        org_id: org.id,
        stock_item_id: itemId || null,
        component_id: componentId || null,
        requesting_location_id: locationId,
        quantity: qty,
        quantity_unit: (quantityUnit || '').trim() || null,
        priority: priority === 'high' ? 'high' : 'low',
        note: (note || '').trim() || null,
        requested_by_name: (name || '').trim() || null,
      }]);
      if (insertError) return jsonResponse({ error: insertError.message }, 400);

    } else if (action === 'fulfill') {
      const { requestId, sourceLocationId, name } = body;

      const { data: request } = await supabase.from('transfer_requests').select('id').eq('id', requestId).eq('org_id', org.id).eq('status', 'open').single();
      if (!request) return jsonResponse({ error: 'That request is no longer open.' }, 400);

      const { data: loc } = await supabase.from('locations').select('id').eq('id', sourceLocationId).eq('org_id', org.id).single();
      if (!loc) return jsonResponse({ error: 'Unknown site.' }, 400);

      const { error: updateError } = await supabase.from('transfer_requests').update({
        status: 'fulfilled',
        source_location_id: sourceLocationId,
        actioned_by_name: (name || '').trim() || null,
        actioned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', requestId);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);

    } else if (action === 'flag_low') {
      const { itemId, locationId, name } = body;

      // Only a SKU that's actually carried at that site (i.e. has a
      // stock_item_sites row) can be flagged -- that row is what admin
      // sees the flag on in Stocktake.
      const { data: siteRow } = await supabase.from('stock_item_sites').select('id').eq('item_id', itemId).eq('location_id', locationId).eq('org_id', org.id).single();
      if (!siteRow) return jsonResponse({ error: "That SKU isn't carried at that site." }, 400);

      const { error: flagError } = await supabase.from('stock_item_sites').update({
        staff_flagged_low: true,
        staff_flagged_at: new Date().toISOString(),
        staff_flagged_by_name: (name || '').trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', siteRow.id);
      if (flagError) return jsonResponse({ error: flagError.message }, 400);
    }

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    // Dashboard overview: open requests, and the locations/items/components
    // needed to label them and build the request form. No requester
    // identity beyond whatever free-text name someone typed in -- this
    // link goes to every staff member, so there's no login to attach a
    // real account to.
    const [{ data: locations }, { data: items }, { data: components }, { data: requests }, { data: carries }] = await Promise.all([
      supabase.from('locations').select('id, name').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      // Not filtered to active -- an existing open request may reference an
      // item since deactivated, and it still needs to resolve for display.
      // The client filters to active ones itself when building the "request
      // something" picker.
      supabase.from('stock_items').select('id, name, sku, uom, active').eq('org_id', org.id).order('sort_order'),
      supabase.from('recipe_components').select('id, name, uom, active').eq('org_id', org.id).order('sort_order'),
      // Priority ascending puts 'high' before 'low' alphabetically -- the
      // only two values, so this stays correct without a custom order.
      supabase.from('transfer_requests').select('id, stock_item_id, component_id, requesting_location_id, quantity, quantity_unit, priority, note, requested_at, requested_by_name').eq('org_id', org.id).eq('status', 'open').order('priority', { ascending: true }).order('requested_at', { ascending: false }),
      // Which SKUs are actually carried at which site -- only those can be
      // flagged as running low, since flagging writes to this same row.
      supabase.from('stock_item_sites').select('item_id, location_id').eq('org_id', org.id),
    ]);

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Transfer Hub',
      locations: locations || [],
      items: items || [],
      components: components || [],
      requests: requests || [],
      carries: carries || [],
    });

  } catch (err) {
    console.error('public-transfer-hub error:', err);
    return jsonResponse({ error: String(err) });
  }
});
