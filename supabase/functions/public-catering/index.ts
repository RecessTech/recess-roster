import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up org by the single staff-surface public token -- Staff Hub,
    // the production plan, Transfer Hub and Prep List all share one token,
    // so there's exactly one link to distribute and regenerate.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
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

    // gross_rev is deliberately excluded from the select -- this is a
    // staff-facing surface, not admin, and revenue should never leave the
    // server for this link, not just be hidden client-side.
    //
    // Every job, not just one day's -- job volume is low enough (dozens,
    // not thousands) to load in one query, same reasoning as the admin
    // app's own db.getCateringJobs. The client groups this into "this
    // week" and a full calendar with per-date job dots, so a single
    // fetch covers both instead of one round-trip per date or month.
    const { data: jobs } = await supabase
      .from('catering_jobs')
      .select(`
        id, job_date, company, contact, job_type, address, ready_by, deliver_by,
        delivery_method, platter_size, pieces_per_person, salads, breakfast_ppl,
        coffee_ppl, gf_ppl, vego_ppl, pb_ppl, dairy_free_ppl, halal_ppl,
        confirmed, invoiced, bread_ordered, delivery_booked, notes, items
      `)
      .eq('org_id', org.id)
      .order('job_date', { ascending: true })
      .order('ready_by', { ascending: true, nullsFirst: false });

    return new Response(JSON.stringify({
      businessName: settings?.business_name || org.name || 'Catering',
      jobs: jobs || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('public-catering error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
