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
    const { token } = await req.json();
    if (!token) return jsonResponse({ error: 'Missing token' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Same single staff-surface public token as the rest of the Staff Hub.
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('id, name')
      .eq('staff_hub_public_token', token)
      .single();

    if (orgError || !org) return jsonResponse({ error: 'Invalid or expired link.' });

    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_name')
      .eq('org_id', org.id)
      .single();

    const { data: items } = await supabase
      .from('production_items')
      .select('id, name, category, active')
      .eq('org_id', org.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    const { data: allergens } = await supabase
      .from('menu_allergens')
      .select('production_item_id, ingredients, contains, may_contain, status, notes')
      .eq('org_id', org.id);

    const byItem = new Map((allergens || []).map((a) => [a.production_item_id, a]));

    // Every active menu item is returned. Items with no menu_allergens row
    // come back with status 'missing' -- the app must show those as "not
    // recorded", never as allergen-free.
    const out = (items || [])
      .filter((i) => i.active !== false)
      .map((i) => {
        const a = byItem.get(i.id);
        return {
          id: i.id,
          name: i.name,
          category: i.category || 'Other',
          status: a ? a.status : 'missing',
          contains: a?.contains || [],
          mayContain: a?.may_contain || [],
          ingredients: a?.ingredients || '',
          notes: a?.notes || '',
        };
      });

    return jsonResponse({
      businessName: settings?.business_name || org.name || 'Allergens',
      items: out,
    });
  } catch (err) {
    console.error('public-allergens error:', err);
    return jsonResponse({ error: String(err) });
  }
});
