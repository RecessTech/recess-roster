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

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_PER_ORG = 40;
const STATUSES = ['ok', 'low', 'urgent'];

// Hardcoded for now, per Clark -- revisit if the team grows past these four.
const STAFF_OPTIONS = ['Amrin', 'Slim', 'Matilda', 'Paddy'];

function todayIn(timezone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  }
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
      .select('id, name, timezone, roster_view_pin, prep_last_reset_date')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    const tz = org.timezone || 'Australia/Sydney';
    const today = todayIn(tz);

    // ── Lazy day reset, applied on the first request past local midnight
    // (same pattern this app uses everywhere else for "today" -- no cron
    // job needed). Any flagged task without carry_forward clears back to
    // 'ok'; one with carry_forward survives this one reset, but the flag
    // itself is consumed so it needs pressing again to survive the next.
    if (org.prep_last_reset_date !== today) {
      await supabase.from('prep_tasks').update({
        status: 'ok', carry_forward: false, assigned_to: null, note: null, catering: false, done: false, flagged_at: null, priority: 2,
      }).eq('org_id', org.id).neq('status', 'ok').eq('carry_forward', false);
      await supabase.from('prep_tasks').update({ carry_forward: false }).eq('org_id', org.id).eq('carry_forward', true);

      // Standing tasks (the 2kg of bacon) always come back urgent, highest
      // priority, first in the list, at their default qty -- overriding
      // whatever else is going on with them, since "every morning,
      // doesn't change" means unconditionally, not just when nothing else
      // flagged it first.
      await supabase.from('prep_tasks').update({
        status: 'urgent', priority: 1, flag_order: -1, flagged_at: new Date().toISOString(), done: false,
      }).eq('org_id', org.id).eq('auto_include', true).eq('active', true);
      const { data: autoTasks } = await supabase.from('prep_tasks').select('id, default_qty, default_uom').eq('org_id', org.id).eq('auto_include', true).eq('active', true);
      for (const t of (autoTasks || [])) {
        await supabase.from('prep_tasks').update({ flag_qty: t.default_qty, flag_uom: t.default_uom }).eq('id', t.id);
      }

      await supabase.from('organisations').update({ prep_last_reset_date: today }).eq('id', org.id);
    }

    // ── Mark a flagged task done, or un-done. No PIN -- every staff member
    // can tick things off; who did it doesn't matter, so nothing records
    // an identity. The task stays on the Plan either way (struck through
    // once done) -- it only actually clears at the next reset.
    if (action === 'toggleComplete') {
      const { itemId, done } = body;
      const { data: item } = await supabase.from('prep_tasks').select('id').eq('id', itemId).eq('org_id', org.id).neq('status', 'ok').single();
      if (!item) return jsonResponse({ error: 'That task is no longer on the plan.' }, 400);

      const { error: updateError } = await supabase.from('prep_tasks').update({ done: !!done }).eq('id', itemId);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);

      // The client applies this optimistically -- just confirm, skip the
      // full catalog/plan refetch below.
      return jsonResponse({ ok: true });
    }

    // ── Everything below is admin-only: re-check the shared roster PIN on
    // every call (stateless, same brute-force lockout as Day Roster/My
    // Roster -- see staff_pin_attempts).
    const isAdminAction = ['unlock', 'createTask', 'setFlag', 'reorderFlags', 'setCarryForward'].includes(action);
    let pinOk = false;
    if (isAdminAction) {
      const { pin } = body;
      if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return jsonResponse({ error: 'Enter the 4-digit PIN.', code: 'bad_pin' });

      const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
      const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();
      const [{ count: ipFails }, { count: orgFails }] = await Promise.all([
        supabase.from('staff_pin_attempts').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('ip', ip).gte('created_at', since),
        supabase.from('staff_pin_attempts').select('id', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', since),
      ]);
      if ((ipFails ?? 0) >= MAX_FAILS_PER_IP || (orgFails ?? 0) >= MAX_FAILS_PER_ORG) {
        return jsonResponse({ error: 'Too many incorrect attempts. Try again in 15 minutes, or ask your manager.', code: 'locked' });
      }

      if (!org.roster_view_pin || org.roster_view_pin !== pin) {
        await supabase.from('staff_pin_attempts').insert({ org_id: org.id, ip });
        await supabase.from('staff_pin_attempts').delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        const left = Math.max(0, MAX_FAILS_PER_IP - (ipFails ?? 0) - 1);
        return jsonResponse({ error: left > 0 ? `Incorrect PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Incorrect PIN.', code: 'bad_pin' });
      }
      pinOk = true;
    }

    if (action === 'createTask' && pinOk) {
      const { name, defaultQty, defaultUom } = body;
      const trimmed = (name || '').trim();
      if (!trimmed) return jsonResponse({ error: 'Name a task.' }, 400);

      const { data: maxRow } = await supabase.from('prep_tasks').select('sort_order').eq('org_id', org.id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data: created, error: createError } = await supabase.from('prep_tasks').insert({
        org_id: org.id, name: trimmed,
        default_qty: defaultQty === '' || defaultQty == null ? null : Number(defaultQty),
        default_uom: (defaultUom || '').trim() || null,
        sort_order: (maxRow?.sort_order ?? -1) + 1,
      }).select('id, name, default_qty, default_uom, auto_include, status, flag_qty, flag_uom, assigned_to, note, catering, done, carry_forward, priority, flag_order').single();
      if (createError) return jsonResponse({ error: createError.message }, 400);

      return jsonResponse({ task: created });
    }

    // Flag (or clear) a task: sets its status plus the instance fields
    // that go with it. Clearing back to 'ok' also drops carry_forward and
    // done -- there's nothing to carry or tick once it's not flagged.
    if (action === 'setFlag' && pinOk) {
      const { taskId, status, qty, uom, assignedTo, note, catering, priority } = body;
      if (!STATUSES.includes(status)) return jsonResponse({ error: 'Unknown status.' }, 400);

      const update: Record<string, unknown> = {
        status,
        // Qty is deliberately optional -- '' / null / undefined all mean
        // "no quantity", not "default to 0".
        flag_qty: qty === '' || qty == null ? null : Number(qty),
        flag_uom: (uom || '').trim() || null,
        assigned_to: (assignedTo || '').trim() || null,
        note: (note || '').trim() || null,
        catering: !!catering,
        flagged_at: status === 'ok' ? null : new Date().toISOString(),
      };
      if ([1, 2, 3].includes(priority)) update.priority = priority;

      if (status === 'ok') {
        update.carry_forward = false;
        update.done = false;
        update.priority = 2;
      } else {
        // Newly (re-)flagged tasks land at the back of the queue by
        // default -- admin reorders from there with drag-and-drop.
        const { data: existing } = await supabase.from('prep_tasks').select('status').eq('id', taskId).single();
        if (existing?.status === 'ok') {
          const { data: maxRow } = await supabase.from('prep_tasks').select('flag_order').eq('org_id', org.id).neq('status', 'ok').order('flag_order', { ascending: false }).limit(1).maybeSingle();
          update.flag_order = (maxRow?.flag_order ?? -1) + 1;
        }
      }

      const { error: updateError } = await supabase.from('prep_tasks').update(update).eq('id', taskId).eq('org_id', org.id);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);
    }

    if (action === 'setCarryForward' && pinOk) {
      const { taskId, carryForward } = body;
      const { error: updateError } = await supabase.from('prep_tasks').update({ carry_forward: !!carryForward }).eq('id', taskId).eq('org_id', org.id);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);
    }

    // Drag-and-drop reorder: the client sends the full set of currently-
    // flagged task ids in their new order (within one priority tier, or
    // across the whole flagged list -- doesn't matter, flag_order is
    // only ever used as a tiebreaker after priority), and every one of
    // them gets rewritten to its index. Scoped to this org's flagged
    // tasks only, so a stale/foreign id can't smuggle in an update.
    if (action === 'reorderFlags' && pinOk) {
      const order: string[] = Array.isArray(body.order) ? body.order : [];
      const { data: flagged } = await supabase.from('prep_tasks').select('id').eq('org_id', org.id).neq('status', 'ok');
      const validIds = new Set((flagged || []).map(t => t.id));
      await Promise.all(
        order.filter(id => validIds.has(id)).map((id, idx) =>
          supabase.from('prep_tasks').update({ flag_order: idx }).eq('id', id)
        )
      );
    }

    const { data: settings } = await supabase.from('business_settings').select('business_name').eq('org_id', org.id).maybeSingle();

    // Plan view: everything currently flagged, ordered by the admin-set
    // priority (1 highest) and then by drag position within a tier --
    // already-done tasks sink to the bottom so the still-outstanding
    // ones surface first. Status (Urgent/Running Low) is now purely a
    // descriptive tag, not a sort key.
    const { data: flaggedRows } = await supabase
      .from('prep_tasks')
      .select('id, name, status, flag_qty, flag_uom, assigned_to, note, catering, done, flagged_at, carry_forward, priority, flag_order')
      .eq('org_id', org.id).eq('active', true).neq('status', 'ok');
    const planItems = (flaggedRows || [])
      .sort((a, b) => (Number(a.done) - Number(b.done)) || (a.priority - b.priority) || (a.flag_order - b.flag_order))
      .map(r => ({
        id: r.id, name: r.name, status: r.status, qty: r.flag_qty, uom: r.flag_uom,
        assignedTo: r.assigned_to, note: r.note, catering: r.catering, done: r.done, flaggedAt: r.flagged_at,
        carryForward: r.carry_forward, priority: r.priority,
      }));

    const responseBody: Record<string, unknown> = {
      businessName: settings?.business_name || org.name || 'Prep List',
      today,
      planItems,
      // Harmless to send unconditionally -- the staff tab doesn't need a
      // PIN for anything, but the name list itself isn't sensitive.
      staffOptions: STAFF_OPTIONS,
    };

    // The full catalog (including unflagged tasks, for the "walk every
    // task" flagging screen) only goes out once the PIN has been verified.
    if (pinOk) {
      const { data: catalogRows } = await supabase
        .from('prep_tasks')
        .select('id, name, default_qty, default_uom, auto_include, status, flag_qty, flag_uom, assigned_to, note, catering, done, carry_forward, priority, flag_order')
        .eq('org_id', org.id).eq('active', true)
        .order('sort_order', { ascending: true }).order('name', { ascending: true });
      responseBody.catalog = catalogRows || [];
    }

    return jsonResponse(responseBody);

  } catch (err) {
    console.error('public-prep-list error:', err);
    return jsonResponse({ error: String(err) });
  }
});
