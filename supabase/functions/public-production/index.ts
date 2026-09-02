import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { token, date } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const planDate = date || todayStr();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up org by production-plan public token
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('production_public_token', token)
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

    const [{ data: sites }, { data: channels }, { data: items }, { data: entries }] = await Promise.all([
      supabase.from('production_sites').select('id, name, sort_order').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('production_channels').select('id, name, site_id, sort_order').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('production_items').select('id, name, category, color, sort_order').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('production_plan_entries').select('item_id, channel_id, qty').eq('org_id', org.id).eq('plan_date', planDate),
    ]);

    return new Response(JSON.stringify({
      businessName: settings?.business_name || org.name || 'Production Plan',
      date: planDate,
      sites: sites || [],
      channels: channels || [],
      items: items || [],
      entries: entries || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('public-production error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
