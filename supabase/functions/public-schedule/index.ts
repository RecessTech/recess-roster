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

    // Look up staff by public token
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, name, org_id')
      .eq('public_token', token)
      .single();

    if (staffError || !staffData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get business name
    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', staffData.org_id)
      .single();

    // Compute week dates (7 days from Monday)
    const startDate = weekStart ? new Date(weekStart) : getMondayOfWeek(new Date());
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d;
    });
    const dateKeys = dates.map(d => d.toISOString().split('T')[0]);

    // Fetch schedule slots for this staff this week
    const { data: slots } = await supabase
      .from('schedules')
      .select('date_key, time_slot')
      .eq('staff_id', staffData.id)
      .in('date_key', dateKeys);

    // Group by date
    const slotsByDate: Record<string, string[]> = {};
    dateKeys.forEach(dk => { slotsByDate[dk] = []; });
    (slots || []).forEach(s => {
      if (slotsByDate[s.date_key]) slotsByDate[s.date_key].push(s.time_slot);
    });
    dateKeys.forEach(dk => slotsByDate[dk].sort());

    const days = dates.map((date, i) => {
      const dk = dateKeys[i];
      const dow = date.getDay();
      return {
        dateKey: dk,
        label: date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        isWeekend: dow === 0 || dow === 6,
        slots: slotsByDate[dk],
      };
    });

    return new Response(JSON.stringify({
      staffName: staffData.name,
      businessName: settings?.business_name || 'Your Roster',
      weekStart: dateKeys[0],
      days,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('public-schedule error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
