import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Staff-facing roster behind a personal 4-digit PIN. The Staff Hub token
// (organisations.staff_hub_public_token) says which org; the PIN
// (staff.pin, unique per org) says which person. Every call re-checks
// both, so there's no session to steal -- the client just holds the PIN
// in sessionStorage. A caller only ever gets their own shifts and their
// own availability back.
//
// Actions: 'load' (a week + next shift + upcoming time off),
// 'set-unavailable' (mark dates), 'clear-unavailable' (undo them).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_PER_ORG = 40;
const MAX_DATES_PER_CALL = 62;
const MAX_NOTE_LENGTH = 200;
const NEXT_SHIFT_LOOKAHEAD_DAYS = 28;
const TIME_OFF_LOOKAHEAD_DAYS = 365;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// ── Date helpers: everything is a 'YYYY-MM-DD' key, manipulated in UTC so
// the server's own timezone never shifts a day.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateKey: string): string {
  const dow = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return addDays(dateKey, dow === 0 ? -6 : 1 - dow);
}

// "Today" in the org's own timezone -- a 11pm Sunday shouldn't already be Monday.
function todayIn(timezone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
  }
}

function dayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// ── Shift helpers

function slotMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number);
  return h * 60 + m;
}

function minutesToSlot(total: number): string {
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

type SlotRow = { time_slot: string; role_code: string | null; role_color: string | null };
type Shift = { start: string; end: string; hours: number; roleCode: string | null; roleColor: string | null };

// Group one day's 15-minute slots into contiguous shift blocks, splitting on
// a gap or a change of role. A slot marks the *start* of a 15-minute block,
// so a shift's end is its last slot + 15m.
function groupIntoShifts(rows: SlotRow[]): Shift[] {
  const sorted = [...rows].sort((a, b) => slotMinutes(a.time_slot) - slotMinutes(b.time_slot));
  const shifts: Shift[] = [];
  let current: Shift | null = null;
  let prevMins = -999;

  for (const row of sorted) {
    const mins = slotMinutes(row.time_slot);
    if (current && current.roleCode === row.role_code && mins - prevMins === 15) {
      current.end = minutesToSlot(mins + 15);
      current.hours = (mins + 15 - slotMinutes(current.start)) / 60;
    } else {
      current = {
        start: row.time_slot, end: minutesToSlot(mins + 15), hours: 0.25,
        roleCode: row.role_code, roleColor: row.role_color,
      };
      shifts.push(current);
    }
    prevMins = mins;
  }
  return shifts;
}

function groupSlotsByDate(rows: (SlotRow & { date_key: string })[]) {
  const byDate = new Map<string, SlotRow[]>();
  for (const r of rows) {
    if (!byDate.has(r.date_key)) byDate.set(r.date_key, []);
    byDate.get(r.date_key)!.push(r);
  }
  return byDate;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token, pin, action = 'load' } = body;

    if (!token || typeof token !== 'string') return json({ error: 'Missing token' });
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return json({ error: 'Enter your 4-digit PIN.', code: 'bad_pin' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: org } = await supabase
      .from('organisations')
      .select('id, name, timezone')
      .eq('staff_hub_public_token', token)
      .single();

    if (!org) return json({ error: 'Invalid or expired link.', code: 'bad_link' });

    // ── Brute-force lockout. Checked *before* the PIN is compared, so a
    // locked-out caller can't keep probing. Only failures count, and they
    // age out of the window on their own.
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

    const { data: staff } = await supabase
      .from('staff')
      .select('id, name')
      .eq('org_id', org.id)
      .eq('pin', pin)
      .eq('active', true)
      .maybeSingle();

    if (!staff) {
      await supabase.from('staff_pin_attempts').insert({ org_id: org.id, ip });
      // Housekeeping: nothing older than a day is useful.
      await supabase.from('staff_pin_attempts').delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      const left = Math.max(0, MAX_FAILS_PER_IP - (ipFails ?? 0) - 1);
      return json({
        error: left > 0 ? `Incorrect PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Incorrect PIN.',
        code: 'bad_pin',
      });
    }

    const today = todayIn(org.timezone || 'Australia/Sydney');

    // ── set-unavailable / clear-unavailable
    if (action === 'set-unavailable' || action === 'clear-unavailable') {
      const dates: unknown = body.dates;
      if (!Array.isArray(dates) || dates.length === 0 || !dates.every(isDateKey)) {
        return json({ error: 'Pick at least one valid date.' });
      }
      const unique = [...new Set(dates as string[])];
      if (unique.length > MAX_DATES_PER_CALL) {
        return json({ error: `Pick at most ${MAX_DATES_PER_CALL} days at a time.` });
      }
      if (unique.some(d => d < today)) {
        return json({ error: "You can't change dates that have already passed." });
      }

      if (action === 'clear-unavailable') {
        // Only ever remove "unavailable" rows -- never a manager's own entries.
        const { error } = await supabase.from('staff_availability').delete()
          .eq('staff_id', staff.id).eq('status', 'unavailable').in('date', unique);
        if (error) throw error;
        return json({ ok: true });
      }

      const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE_LENGTH) : '';
      const { error } = await supabase.from('staff_availability').upsert(
        unique.map(date => ({
          org_id: org.id, staff_id: staff.id, date, status: 'unavailable',
          start_time: null, end_time: null, notes: note || null,
        })),
        { onConflict: 'staff_id,date' }
      );
      if (error) throw error;

      // Tell them if they've just blocked out a day they're already rostered
      // on -- saved anyway, but that's a conversation with their manager.
      const { data: clashes } = await supabase.from('schedules').select('date_key')
        .eq('staff_id', staff.id).in('date_key', unique);
      const rostered = [...new Set((clashes || []).map(c => c.date_key))].sort();
      return json({ ok: true, rostered: rostered.map(d => ({ dateKey: d, label: dayLabel(d) })) });
    }

    if (action !== 'load') return json({ error: 'Unknown action.' });

    // ── load
    const weekStart = mondayOf(isDateKey(body.weekStart) ? body.weekStart : today);
    const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const lookaheadEnd = addDays(today, NEXT_SHIFT_LOOKAHEAD_DAYS);
    const timeOffEnd = addDays(today, TIME_OFF_LOOKAHEAD_DAYS);

    const [{ data: settings }, { data: published }, { data: weekSlots }, { data: upcomingSlots }, { data: weekAvail }, { data: timeOff }] =
      await Promise.all([
        supabase.from('business_settings').select('business_name').eq('org_id', org.id).maybeSingle(),
        supabase.from('published_weeks').select('id').eq('org_id', org.id).eq('week_start', weekStart).maybeSingle(),
        supabase.from('schedules').select('date_key, time_slot, role_code, role_color')
          .eq('staff_id', staff.id).in('date_key', weekKeys),
        supabase.from('schedules').select('date_key, time_slot, role_code, role_color')
          .eq('staff_id', staff.id).gte('date_key', today).lte('date_key', lookaheadEnd),
        supabase.from('staff_availability').select('date, status, notes')
          .eq('staff_id', staff.id).in('date', weekKeys),
        supabase.from('staff_availability').select('date, notes')
          .eq('staff_id', staff.id).eq('status', 'unavailable')
          .gte('date', today).lte('date', timeOffEnd).order('date', { ascending: true }),
      ]);

    const slotsByDate = groupSlotsByDate(weekSlots || []);
    const availByDate = new Map((weekAvail || []).map(a => [a.date, a]));

    const days = weekKeys.map(dateKey => {
      const dow = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
      const avail = availByDate.get(dateKey);
      return {
        dateKey,
        label: dayLabel(dateKey),
        isWeekend: dow === 0 || dow === 6,
        isToday: dateKey === today,
        isPast: dateKey < today,
        shifts: groupIntoShifts(slotsByDate.get(dateKey) || []),
        unavailable: avail?.status === 'unavailable' ? { note: avail.notes || '' } : null,
      };
    });

    // Next shift still to come (a shift already finished today doesn't count).
    const nowMins = (() => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: org.timezone || 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date());
      const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
      const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
      return h * 60 + m;
    })();
    const upcomingByDate = groupSlotsByDate(upcomingSlots || []);
    let nextShift: (Shift & { dateKey: string; label: string }) | null = null;
    for (const dk of [...upcomingByDate.keys()].sort()) {
      const upcoming = groupIntoShifts(upcomingByDate.get(dk)!)
        .find(s => dk > today || slotMinutes(s.end) > nowMins);
      if (upcoming) { nextShift = { ...upcoming, dateKey: dk, label: dayLabel(dk) }; break; }
    }

    return json({
      staffName: staff.name,
      businessName: settings?.business_name || org.name || 'R-Shift',
      today,
      weekStart,
      published: !!published,
      weekHours: days.reduce((sum, d) => sum + d.shifts.reduce((s, sh) => s + sh.hours, 0), 0),
      days,
      nextShift,
      timeOff: (timeOff || []).map(t => ({ dateKey: t.date, label: dayLabel(t.date), note: t.notes || '' })),
    });

  } catch (err) {
    console.error('staff-roster error:', err);
    return json({ error: 'Something went wrong. Please try again.' });
  }
});
