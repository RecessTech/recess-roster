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

// "Today" for a run is the site's own local business day, not the
// server's UTC day -- otherwise the daily reset would land at UTC
// midnight (10am/11am Sydney time) instead of actual local midnight.
function localDateString(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token, action } = body;
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);

    // Service role -- bypasses RLS, so every write below re-checks org_id
    // itself rather than trusting the client. Same pattern as the other
    // public-facing edge functions (Transfer Hub, Prep List).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Shares the one staff-surface token with Staff Hub, R-Prod, Transfer
    // Hub and Prep List -- no separate link to distribute for this.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, timezone')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    const timezone = org.timezone || 'Australia/Sydney';
    const today = localDateString(timezone);

    if (action === 'get_checklist') {
      const { siteId, type } = body;
      if (!siteId || (type !== 'opening' && type !== 'closing')) {
        return jsonResponse({ error: 'Missing site or type.' }, 400);
      }

      const { data: site } = await supabase.from('production_sites').select('id, name').eq('id', siteId).eq('org_id', org.id).single();
      if (!site) return jsonResponse({ error: 'Unknown site.' }, 400);

      let { data: run } = await supabase
        .from('checklist_runs')
        .select('*')
        .eq('site_id', siteId).eq('type', type).eq('run_date', today)
        .maybeSingle();

      if (!run) {
        const { data: template } = await supabase
          .from('checklist_items')
          .select('id, name, details, sort_order')
          .eq('site_id', siteId).eq('type', type).eq('active', true)
          .order('sort_order');

        const { data: created, error: createError } = await supabase
          .from('checklist_runs')
          .insert([{ org_id: org.id, site_id: siteId, type, run_date: today }])
          .select('*')
          .single();
        if (createError) return jsonResponse({ error: createError.message }, 400);
        run = created;

        if (template && template.length > 0) {
          const { error: itemsError } = await supabase.from('checklist_run_items').insert(
            template.map(t => ({
              org_id: org.id, run_id: run!.id, item_id: t.id,
              name: t.name, details: t.details, sort_order: t.sort_order,
            }))
          );
          if (itemsError) return jsonResponse({ error: itemsError.message }, 400);
        }
      }

      const { data: runItems } = await supabase
        .from('checklist_run_items')
        .select('*')
        .eq('run_id', run.id)
        .order('sort_order');

      // Whatever the previous closing shift left as a handoff note, so an
      // opener sees it without having to go dig through history. Only
      // fetched for opening -- closing has nothing "before" it to surface.
      let handoff = null;
      if (type === 'opening') {
        const { data: lastClose } = await supabase
          .from('checklist_runs')
          .select('run_date, notes, signed_off_by_name')
          .eq('site_id', siteId).eq('type', 'closing')
          .not('notes', 'is', null)
          .order('run_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastClose?.notes) handoff = lastClose;
      }

      return jsonResponse({ businessName: org.name, site, run, runItems: runItems || [], handoff });

    } else if (action === 'toggle_item') {
      const { runItemId, checked } = body;

      const { data: runItem } = await supabase.from('checklist_run_items').select('id').eq('id', runItemId).eq('org_id', org.id).single();
      if (!runItem) return jsonResponse({ error: 'Unknown checklist item.' }, 400);

      const { error: updateError } = await supabase.from('checklist_run_items').update({
        checked: !!checked,
        checked_at: checked ? new Date().toISOString() : null,
      }).eq('id', runItemId);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);

      return jsonResponse({ ok: true });

    } else if (action === 'sign_off') {
      const { runId, name, notes } = body;
      const trimmedName = (name || '').trim();
      if (!trimmedName) return jsonResponse({ error: 'Enter your name to sign off.' }, 400);

      const { data: run } = await supabase.from('checklist_runs').select('id').eq('id', runId).eq('org_id', org.id).single();
      if (!run) return jsonResponse({ error: 'Unknown checklist.' }, 400);

      const { error: updateError } = await supabase.from('checklist_runs').update({
        signed_off_at: new Date().toISOString(),
        signed_off_by_name: trimmedName,
        notes: (notes || '').trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);

      return jsonResponse({ ok: true });
    }

    // Default: list the sites worth showing -- only ones with at least
    // one active task for either checklist, so a site still being set up
    // (no items yet) doesn't show up as a dead end.
    const { data: sites } = await supabase
      .from('production_sites')
      .select('id, name')
      .eq('org_id', org.id)
      .eq('active', true)
      .order('sort_order').order('created_at');

    const { data: activeItems } = await supabase
      .from('checklist_items')
      .select('site_id')
      .eq('org_id', org.id)
      .eq('active', true);

    const sitesWithItems = new Set((activeItems || []).map(i => i.site_id));
    const visibleSites = (sites || []).filter(s => sitesWithItems.has(s.id));

    return jsonResponse({ businessName: org.name, sites: visibleSites });

  } catch (err) {
    console.error('public-checklists error:', err);
    return jsonResponse({ error: String(err) });
  }
});
