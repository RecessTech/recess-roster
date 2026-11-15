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
      .select('id, name, timezone, roster_view_pin')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    const tz = org.timezone || 'Australia/Sydney';
    const today = todayIn(tz);

    // ── Mark a task done / not done. No PIN -- every staff member can
    // tick things off through the day, same as the old Prep List. Who
    // ticked it doesn't matter, so nothing records an identity here.
    if (action === 'toggleComplete') {
      const { itemId, done } = body;
      const { data: item } = await supabase.from('prep_plan_items').select('id').eq('id', itemId).eq('org_id', org.id).single();
      if (!item) return jsonResponse({ error: 'That task is no longer on the plan.' }, 400);

      const { error: updateError } = await supabase.from('prep_plan_items').update(
        done
          ? { status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          : { status: 'pending', completed_at: null, updated_at: new Date().toISOString() }
      ).eq('id', itemId);
      if (updateError) return jsonResponse({ error: updateError.message }, 400);

      // The client applies this optimistically and only needs confirmation
      // -- skip the standing-task seed check and the full plan/catalog
      // refetch below (that round trip is what made ticking something off
      // feel slow). A toggle never touches the catalog or seeding anyway,
      // since the item being toggled already proves the day has rows.
      return jsonResponse({ ok: true });
    }

    // ── Everything below is admin-only: re-check the shared roster PIN on
    // every call (stateless, same brute-force lockout as Day Roster/My
    // Roster -- see staff_pin_attempts).
    const isAdminAction = action === 'unlock' || action === 'createTask' || action === 'savePlan';
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
      }).select('id, name, default_qty, default_uom, auto_include').single();
      if (createError) return jsonResponse({ error: createError.message }, 400);

      return jsonResponse({ task: created });
    }

    if (action === 'savePlan' && pinOk) {
      const items = Array.isArray(body.items) ? body.items : [];

      const { data: existingRows } = await supabase.from('prep_plan_items').select('id, task_id').eq('org_id', org.id).eq('plan_date', today);
      const existingTaskIds = new Set((existingRows || []).map(r => r.task_id));
      const submittedTaskIds = new Set(items.map((i: any) => i.taskId));

      const toRemove = [...existingTaskIds].filter(id => !submittedTaskIds.has(id));
      if (toRemove.length > 0) {
        const { error: delError } = await supabase.from('prep_plan_items').delete().eq('org_id', org.id).eq('plan_date', today).in('task_id', toRemove);
        if (delError) return jsonResponse({ error: delError.message }, 400);
      }

      // Upsert by (org_id, plan_date, task_id) -- status/completed_at are
      // deliberately left out of the payload so a re-save never un-ticks
      // something staff already finished.
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        if (!it.taskId) continue;
        const { error: upsertError } = await supabase.from('prep_plan_items').upsert({
          org_id: org.id, plan_date: today, task_id: it.taskId,
          qty: it.qty === '' || it.qty == null ? null : Number(it.qty),
          uom: (it.uom || '').trim() || null,
          assigned_to: (it.assignedTo || '').trim() || null,
          sort_order: idx,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,plan_date,task_id' });
        if (upsertError) return jsonResponse({ error: upsertError.message }, 400);
      }
    }

    // ── Standing tasks (e.g. the 2 trays of bacon) belong on every day's
    // plan -- re-seed any that are missing whenever the day has no items
    // at all yet, so nobody has to remember to add them each morning.
    const { count: dayCount } = await supabase.from('prep_plan_items').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('plan_date', today);
    if (!dayCount) {
      const { data: autoTasks } = await supabase.from('prep_tasks').select('id, default_qty, default_uom').eq('org_id', org.id).eq('auto_include', true).eq('active', true);
      if (autoTasks && autoTasks.length > 0) {
        await supabase.from('prep_plan_items').upsert(
          autoTasks.map((t, idx) => ({
            org_id: org.id, plan_date: today, task_id: t.id,
            qty: t.default_qty, uom: t.default_uom, sort_order: idx,
          })),
          { onConflict: 'org_id,plan_date,task_id' }
        );
      }
    }

    const { data: settings } = await supabase.from('business_settings').select('business_name').eq('org_id', org.id).maybeSingle();

    const { data: planRows } = await supabase
      .from('prep_plan_items')
      .select('id, task_id, qty, uom, assigned_to, sort_order, status, completed_at')
      .eq('org_id', org.id).eq('plan_date', today)
      .order('sort_order', { ascending: true });

    const taskIds = [...new Set((planRows || []).map(r => r.task_id))];
    const { data: taskRows } = taskIds.length
      ? await supabase.from('prep_tasks').select('id, name, default_qty, default_uom, auto_include').in('id', taskIds)
      : { data: [] as any[] };
    const taskById = new Map((taskRows || []).map(t => [t.id, t]));

    const planItems = (planRows || []).map(r => ({
      id: r.id,
      taskId: r.task_id,
      name: taskById.get(r.task_id)?.name || 'Unknown task',
      qty: r.qty,
      uom: r.uom,
      assignedTo: r.assigned_to,
      sortOrder: r.sort_order,
      status: r.status,
      completedAt: r.completed_at,
    }));

    const responseBody: Record<string, unknown> = {
      businessName: settings?.business_name || org.name || 'Prep List',
      today,
      planItems,
      // Harmless to send unconditionally -- the staff tab's "who's
      // ticking this off" picker needs the same fixed list, with no PIN.
      staffOptions: STAFF_OPTIONS,
    };

    // The task catalog only goes out once the PIN has been verified --
    // not sensitive, just no reason to hand the full picker list to an
    // anonymous read of the staff tab.
    if (pinOk) {
      const { data: catalogRows } = await supabase
        .from('prep_tasks').select('id, name, default_qty, default_uom, auto_include')
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
