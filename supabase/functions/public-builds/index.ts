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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token } = body;
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Same single staff-surface public token as Staff Hub, R-Prod, Transfer
    // Hub, Prep List and Catering -- one link to distribute and regenerate.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Invalid or expired link.' });
    }

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    // Build guides only exist for Sandwiches and Toasties -- read-only
    // reference data, nothing time- or day-scoped like the other public
    // views, so there's no date param here.
    const { data: items } = await supabase
      .from('production_items')
      .select('id, name, category, active')
      .eq('org_id', org.id)
      .in('category', ['Sandwiches', 'Toasties'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Build Guides',
      items: (items || []).filter(i => i.active !== false),
    });

  } catch (err) {
    console.error('public-builds error:', err);
    return jsonResponse({ error: String(err) });
  }
});
