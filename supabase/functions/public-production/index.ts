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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token, action } = body;
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);
    const planDate = body.date || todayStr();

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

    if (action === 'updatePlan') {
      const { siteId, entries, editedByName } = body;
      const name = (editedByName || '').trim();
      if (!siteId || !Array.isArray(entries) || !name) {
        return jsonResponse({ error: 'Missing site, entries, or name.' }, 400);
      }

      // A day the admin has finalized on the desktop is off-limits from
      // the mobile link -- that unlock has to happen deliberately on
      // desktop, not be silently reopened from a phone.
      const { data: lock } = await supabase
        .from('production_day_locks')
        .select('id')
        .eq('org_id', org.id)
        .eq('site_id', siteId)
        .eq('plan_date', planDate)
        .maybeSingle();
      if (lock) {
        return jsonResponse({ error: 'This day is finalized. Ask an admin to unlock it on the desktop before editing.' });
      }

      // Only channels that actually belong to this site/org can be
      // written to -- ignore anything else the client sends.
      const { data: validChannels } = await supabase
        .from('production_channels')
        .select('id')
        .eq('org_id', org.id)
        .eq('site_id', siteId);
      const validChannelIds = new Set((validChannels || []).map(c => c.id));

      const channelIds = [...new Set(entries.map((e: any) => e.channelId).filter((id: string) => validChannelIds.has(id)))];
      const { data: existingEntries } = channelIds.length
        ? await supabase
            .from('production_plan_entries')
            .select('item_id, channel_id, qty')
            .eq('org_id', org.id)
            .eq('plan_date', planDate)
            .in('channel_id', channelIds)
        : { data: [] };
      const existingMap = new Map((existingEntries || []).map((e: any) => [`${e.item_id}:${e.channel_id}`, Number(e.qty) || 0]));

      const changes: Array<Record<string, unknown>> = [];
      const upserts: Array<Record<string, unknown>> = [];
      for (const e of entries) {
        if (!validChannelIds.has(e.channelId)) continue;
        const key = `${e.itemId}:${e.channelId}`;
        const oldQty = existingMap.get(key) ?? 0;
        const newQty = Number(e.qty) || 0;
        if (oldQty === newQty) continue;
        changes.push({ item_id: e.itemId, channel_id: e.channelId, old_qty: oldQty, new_qty: newQty });
        upserts.push({ org_id: org.id, item_id: e.itemId, channel_id: e.channelId, plan_date: planDate, qty: newQty, updated_at: new Date().toISOString() });
      }

      if (upserts.length > 0) {
        const { error: upsertError } = await supabase
          .from('production_plan_entries')
          .upsert(upserts, { onConflict: 'item_id,channel_id,plan_date' });
        if (upsertError) return jsonResponse({ error: upsertError.message }, 400);

        const { error: logError } = await supabase.from('production_plan_edit_log').insert([{
          org_id: org.id,
          site_id: siteId,
          plan_date: planDate,
          edited_by_name: name,
          changes,
        }]);
        if (logError) console.error('production_plan_edit_log insert error:', logError);
      }
    }

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    const [{ data: sites }, { data: channels }, { data: items }, { data: entries }, { data: locks }, { data: editLog }] = await Promise.all([
      supabase.from('production_sites').select('id, name, sort_order').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('production_channels').select('id, name, site_id, sort_order').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('production_items').select('id, name, category, color, sort_order').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('production_plan_entries').select('item_id, channel_id, qty').eq('org_id', org.id).eq('plan_date', planDate),
      supabase.from('production_day_locks').select('site_id, locked_at').eq('org_id', org.id).eq('plan_date', planDate),
      supabase.from('production_plan_edit_log').select('site_id, edited_by_name, edited_at').eq('org_id', org.id).eq('plan_date', planDate).order('edited_at', { ascending: false }).limit(5),
    ]);

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Production Plan',
      date: planDate,
      sites: sites || [],
      channels: channels || [],
      items: items || [],
      entries: entries || [],
      locks: locks || [],
      editLog: editLog || [],
    });

  } catch (err) {
    console.error('public-production error:', err);
    return jsonResponse({ error: String(err) });
  }
});
