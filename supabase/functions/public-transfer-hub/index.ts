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

    // Look up org by Transfer Hub public token
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('transfer_public_token', token)
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

    // Dashboard overview only: open requests, and the locations/items/
    // components needed to label them. No requester identity -- this link
    // goes to every staff member, so who asked for what stays inside the
    // logged-in app.
    const [{ data: locations }, { data: items }, { data: components }, { data: requests }] = await Promise.all([
      supabase.from('locations').select('id, name').eq('org_id', org.id).eq('active', true).order('sort_order').order('created_at'),
      supabase.from('stock_items').select('id, name, sku, uom').eq('org_id', org.id),
      supabase.from('recipe_components').select('id, name, uom').eq('org_id', org.id),
      supabase.from('transfer_requests').select('id, stock_item_id, component_id, requesting_location_id, quantity, note, requested_at').eq('org_id', org.id).eq('status', 'open').order('requested_at', { ascending: false }),
    ]);

    return new Response(JSON.stringify({
      businessName: settings?.business_name || org.name || 'Transfer Hub',
      locations: locations || [],
      items: items || [],
      components: components || [],
      requests: requests || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('public-transfer-hub error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
