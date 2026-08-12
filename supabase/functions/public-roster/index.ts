import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function slotMinutes(slot: string): number {
  const [h, m] = slot.split(':').map(Number);
  return h * 60 + m;
}

// Group a staff member's sorted slots for one day into contiguous shift
// blocks, splitting on a >15m gap or a change of role.
function groupIntoShifts(rows: { time_slot: string; role_code: string | null; role_color: string | null }[]) {
  const sorted = [...rows].sort((a, b) => slotMinutes(a.time_slot) - slotMinutes(b.time_slot));
  const shifts: { start: string; end: string; roleCode: string | null; roleColor: string | null }[] = [];
  let current: (typeof shifts)[number] | null = null;
  let prevMins = -999;

  for (const row of sorted) {
    const mins = slotMinutes(row.time_slot);
    const sameRole = current && current.roleCode === row.role_code;
    if (current && sameRole && mins - prevMins === 15) {
      current.end = row.time_slot;
    } else {
      current = { start: row.time_slot, end: row.time_slot, roleCode: row.role_code, roleColor: row.role_color };
      shifts.push(current);
    }
    prevMins = mins;
  }
  return shifts;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, weekStart } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up org by public token
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('public_token', token)
      .single();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    const { data: staffOrderRow } = await supabase
      .from('staff_order')
      .select('staff_ids')
      .eq('org_id', org.id)
      .single();

    const { data: staffRows } = await supabase
      .from('staff')
      .select('id, name, active, created_at')
      .eq('org_id', org.id)
      .eq('active', true)
      .order('created_at', { ascending: true });

    let staffList = (staffRows || []).map(s => ({ id: s.id, name: s.name }));
    const order: string[] = staffOrderRow?.staff_ids || [];
    if (order.length > 0) {
      const byId = new Map(staffList.map(s => [s.id, s]));
      const ordered = order.map(id => byId.get(id)).filter(Boolean) as typeof staffList;
      const remaining = staffList.filter(s => !order.includes(s.id));
      staffList = [...ordered, ...remaining];
    }

    // Compute week dates (7 days from Monday)
    const startDate = weekStart ? new Date(weekStart) : getMondayOfWeek(new Date());
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    });
    const dateKeys = dates.map(d => d.toISOString().split('T')[0]);

    const { data: slots } = await supabase
      .from('schedules')
      .select('date_key, staff_id, time_slot, role_code, role_color')
      .eq('org_id', org.id)
      .in('date_key', dateKeys);

    // Group by date_key -> staff_id -> rows
    const byDateStaff = new Map<string, Map<string, { time_slot: string; role_code: string | null; role_color: string | null }[]>>();
    dateKeys.forEach(dk => byDateStaff.set(dk, new Map()));
    (slots || []).forEach(row => {
      const dayMap = byDateStaff.get(row.date_key);
      if (!dayMap) return;
      if (!dayMap.has(row.staff_id)) dayMap.set(row.staff_id, []);
      dayMap.get(row.staff_id)!.push({ time_slot: row.time_slot, role_code: row.role_code, role_color: row.role_color });
    });

    const days = dates.map((date, i) => {
      const dk = dateKeys[i];
      const dow = date.getDay();
      const dayMap = byDateStaff.get(dk)!;
      const shiftsByStaff: Record<string, ReturnType<typeof groupIntoShifts>> = {};
      dayMap.forEach((rows, staffId) => {
        shiftsByStaff[staffId] = groupIntoShifts(rows);
      });
      return {
        dateKey: dk,
        label: date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        isWeekend: dow === 0 || dow === 6,
        shiftsByStaff,
      };
    });

    return new Response(JSON.stringify({
      businessName: settings?.business_name || org.name || 'Your Roster',
      weekStart: dateKeys[0],
      staff: staffList,
      days,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('public-roster error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
