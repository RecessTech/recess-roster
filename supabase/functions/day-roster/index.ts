import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// The whole team's roster for one day, behind a single shared 4-digit PIN
// (organisations.roster_view_pin). The Staff Hub token says which org; the
// PIN proves it's staff rather than anyone who stumbled on the link. NULL
// pin = the page is switched off for that org. Read-only.
//
// Failed PINs are rate-limited through the same staff_pin_attempts table
// as the personal Roster page (staff-roster), so a wrong guess here counts
// against the same per-IP / per-org limits.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_PER_ORG = 40;
const MAX_DAYS_AWAY = 400;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 17;
const MIN_SPAN_HOURS = 6;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// ── Date helpers: 'YYYY-MM-DD' keys, manipulated in UTC so the server's own
// timezone never shifts a day.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

function todayIn(timezone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  }
}

function minutesNowIn(timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

// ── Shift helpers

function slotMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number);
  return h * 60 + m;
}

function minutesToSlot(total: number): string {
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

type SlotRow = {
  staff_id: string; time_slot: string; role_code: string | null; role_color: string | null; location_id: string | null;
};
type Shift = {
  start: string; end: string; hours: number; roleCode: string | null; roleColor: string | null; locationId: string | null;
};

// Group one person's 15-minute slots into contiguous shifts, splitting on a
// gap, a change of role or a change of site. A slot marks the *start* of a
// 15-minute block, so a shift's end is its last slot + 15m.
function groupIntoShifts(rows: SlotRow[]): Shift[] {
  const sorted = [...rows].sort((a, b) => slotMinutes(a.time_slot) - slotMinutes(b.time_slot));
  const shifts: Shift[] = [];
  let current: Shift | null = null;
  let prevMins = -999;

  for (const row of sorted) {
    const mins = slotMinutes(row.time_slot);
    if (current && current.roleCode === row.role_code && current.locationId === row.location_id && mins - prevMins === 15) {
      current.end = minutesToSlot(mins + 15);
      current.hours = (mins + 15 - slotMinutes(current.start)) / 60;
    } else {
      current = {
        start: row.time_slot, end: minutesToSlot(mins + 15), hours: 0.25,
        roleCode: row.role_code, roleColor: row.role_color, locationId: row.location_id,
      };
      shifts.push(current);
    }
    prevMins = mins;
  }
  return shifts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token, pin } = body;

    if (!token || typeof token !== 'string') return json({ error: 'Missing token' });
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return json({ error: 'Enter the 4-digit PIN.', code: 'bad_pin' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, timezone, roster_view_pin')
      .eq('staff_hub_public_token', token)
      .single();

    if (!org) return json({ error: 'Invalid or expired link.', code: 'bad_link' });

    // ── Brute-force lockout, checked *before* the PIN is compared.
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown')
      .split(',')[0].trim();
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS).toISOString();

    const [{ count: ipFails }, { count: orgFails }] = await Promise.all([
      supabase.from('staff_pin_attempts').select('id', { count: 'exact', head: true })
        .eq('org_id', org.id).eq('ip', ip).gte('created_at', since),
      supabase.from('staff_pin_attempts').select('id', { count: 'exact', head: true })
        .eq('org_id', org.id).gte('created_at', since),
    ]);

    if ((ipFails ?? 0) >= MAX_FAILS_PER_IP || (orgFails ?? 0) >= MAX_FAILS_PER_ORG) {
      return json({ error: 'Too many incorrect attempts. Try again in 15 minutes, or ask your manager.', code: 'locked' });
    }

    // An org with no PIN set has the page switched off: nothing matches.
    if (!org.roster_view_pin || org.roster_view_pin !== pin) {
      await supabase.from('staff_pin_attempts').insert({ org_id: org.id, ip });
      await supabase.from('staff_pin_attempts').delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      const left = Math.max(0, MAX_FAILS_PER_IP - (ipFails ?? 0) - 1);
      return json({
        error: left > 0 ? `Incorrect PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Incorrect PIN.',
        code: 'bad_pin',
      });
    }

    const tz = org.timezone || 'Australia/Sydney';
    const today = todayIn(tz);
    const date = isDateKey(body.date) ? body.date : today;
    if (Math.abs(daysBetween(today, date)) > MAX_DAYS_AWAY) {
      return json({ error: 'That date is too far away.' });
    }

    const [{ data: settings }, { data: staffRows }, { data: orderRow }, { data: locations }, { data: slots }, { data: availRows }] =
      await Promise.all([
        supabase.from('business_settings').select('business_name').eq('org_id', org.id).maybeSingle(),
        supabase.from('staff').select('id, name, employment_type, location_id, created_at')
          .eq('org_id', org.id).eq('active', true).order('created_at', { ascending: true }),
        supabase.from('staff_order').select('staff_ids').eq('org_id', org.id).maybeSingle(),
        supabase.from('locations').select('id, name').eq('org_id', org.id).eq('active', true)
          .order('sort_order', { ascending: true }),
        supabase.from('schedules').select('staff_id, time_slot, role_code, role_color, location_id')
          .eq('org_id', org.id).eq('date_key', date),
        supabase.from('staff_availability').select('staff_id, status, notes, start_time, end_time')
          .eq('org_id', org.id).eq('date', date).in('status', ['unavailable', 'partial']),
      ]);

    // Staff in the manager's own roster order; anyone not in that list after.
    let ordered = staffRows || [];
    const order: string[] = orderRow?.staff_ids || [];
    if (order.length > 0) {
      const byId = new Map(ordered.map(s => [s.id, s]));
      const first = order.map(id => byId.get(id)).filter(Boolean) as typeof ordered;
      ordered = [...first, ...ordered.filter(s => !order.includes(s.id))];
    }

    const slotsByStaff = new Map<string, SlotRow[]>();
    for (const r of (slots || [])) {
      if (!slotsByStaff.has(r.staff_id)) slotsByStaff.set(r.staff_id, []);
      slotsByStaff.get(r.staff_id)!.push(r);
    }
    const availByStaff = new Map((availRows || []).map(a => [a.staff_id, a]));

    const staff = ordered.map(s => {
      const rows = slotsByStaff.get(s.id) || [];
      // Shifts saved before per-shift sites existed fall back to the home site.
      const shifts = groupIntoShifts(rows.map(r => ({ ...r, location_id: r.location_id || s.location_id || null })));
      const a = availByStaff.get(s.id);
      return {
        id: s.id,
        name: s.name,
        employmentType: s.employment_type,
        homeLocationId: s.location_id || null,
        shifts,
        availability: a ? {
          kind: a.status === 'partial' ? 'partial' : 'unavailable',
          from: a.status === 'partial' ? a.start_time : null,
          to: a.status === 'partial' ? a.end_time : null,
          note: a.notes || '',
        } : null,
      };
    });

    // Hour range for the timeline: the rostered span rounded out to whole
    // hours, never narrower than MIN_SPAN_HOURS.
    let startHour = DEFAULT_START_HOUR;
    let endHour = DEFAULT_END_HOUR;
    const all = staff.flatMap(s => s.shifts);
    if (all.length > 0) {
      startHour = Math.floor(Math.min(...all.map(s => slotMinutes(s.start))) / 60);
      endHour = Math.ceil(Math.max(...all.map(s => slotMinutes(s.end))) / 60);
      if (endHour - startHour < MIN_SPAN_HOURS) endHour = Math.min(24, startHour + MIN_SPAN_HOURS);
    }

    return json({
      businessName: settings?.business_name || org.name || 'R-Shift',
      today,
      date,
      nowMins: date === today ? minutesNowIn(tz) : null,
      startHour,
      endHour,
      locations: locations || [],
      staff,
    });

  } catch (err) {
    console.error('day-roster error:', err);
    return json({ error: 'Something went wrong. Please try again.' });
  }
});
