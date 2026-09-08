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

    // Same single staff-surface public token as Staff Hub, R-Prod and
    // Transfer Hub -- one link to distribute and regenerate.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    if (action === 'flag') {
      const { componentId, locationId, neededDate, name } = body;

      if (!componentId || !locationId || !neededDate) {
        return jsonResponse({ error: 'Pick a site, a component, and when it is needed.' }, 400);
      }

      // Any component in the org's list can be flagged -- both 'recipe' and
      // 'prep' typed ones, since prep isn't only the type='prep' rows.
      const { data: comp } = await supabase.from('recipe_components').select('id').eq('id', componentId).eq('org_id', org.id).single();
      if (!comp) return jsonResponse({ error: 'Unknown component.' }, 400);

      const { data: loc } = await supabase.from('locations').select('id').eq('id', locationId).eq('org_id', org.id).single();
      if (!loc) return jsonResponse({ error: 'Unknown site.' }, 400);

      // Bulk-prepped, one-off asks: re-flagging the same component at the
      // same site while it's already open just refreshes it (new date, new
      // name, new timestamp) rather than piling up a duplicate row. The
      // partial unique index backs this as a race-safety net, but Postgres
      // ON CONFLICT can't target a partial index through PostgREST's plain
      // upsert, so the check-then-write happens explicitly here instead.
      const { data: existing } = await supabase.from('component_prep_flags').select('id').eq('component_id', componentId).eq('location_id', locationId).eq('status', 'open').maybeSingle();

      const row = {
        needed_date: neededDate,
        flagged_at: new Date().toISOString(),
        flagged_by_name: (name || '').trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: flagError } = existing
        ? await supabase.from('component_prep_flags').update(row).eq('id', existing.id)
        : await supabase.from('component_prep_flags').insert([{
            org_id: org.id,
            component_id: componentId,
            location_id: locationId,
            status: 'open',
            ...row,
          }]);
      if (flagError) return jsonResponse({ error: flagError.message }, 400);

    } else if (action === 'complete') {
      const { flagId, name } = body;

      const { data: flag } = await supabase.from('component_prep_flags').select('id').eq('id', flagId).eq('org_id', org.id).eq('status', 'open').single();
      if (!flag) return jsonResponse({ error: 'That item is no longer on the list.' }, 400);

      const { error: updateError } = await supabase.from('component_prep_flags').update({
        status: 'done',
        completed_at: new Date().toISOString(),
        completed_by_name: (name || '').trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', flagId);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);
    }

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    // Dashboard overview: open flags, and the locations/components needed
    // to label them and build the "flag something" form. Every component
    // in the org's list is flaggable here, not just type='prep' ones. No
    // requester identity beyond whatever free-text name someone typed in --
    // this link goes to every staff member, so there's no login to attach
    // a real account to.
    const [{ data: locations }, { data: components }, { data: flags }] = await Promise.all([
      supabase.from('locations').select('id, name').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('recipe_components').select('id, name, uom, active').eq('org_id', org.id).order('sort_order'),
      supabase.from('component_prep_flags').select('id, component_id, location_id, needed_date, status, flagged_at, flagged_by_name').eq('org_id', org.id).eq('status', 'open').order('needed_date', { ascending: true }).order('flagged_at', { ascending: false }),
    ]);

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Prep List',
      locations: locations || [],
      components: components || [],
      flags: flags || [],
    });

  } catch (err) {
    console.error('public-prep-list error:', err);
    return jsonResponse({ error: String(err) });
  }
});
