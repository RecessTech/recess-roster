import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Polls hello@itsrecess.com.au via the Gmail API for supplier order-
// confirmation emails and records a match for each one it can attribute
// to a supplier, so the Order Status tab can show a verified "Confirmed"
// instead of just "someone ticked Ordered in the Ordering tab".
//
// Called on a schedule (pg_cron + pg_net -- see
// supabase_stock_order_confirmations_migration.sql), not by the app --
// there's no user-facing trigger for this, it just needs to run
// periodically.
//
// Requires three secrets set in the Supabase project (Project Settings
// -> Edge Functions -> Secrets), from a one-time Google Cloud OAuth
// setup for hello@itsrecess.com.au done outside this codebase:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// Until those are set, every run fails at getAccessToken() and no
// confirmations are recorded -- the Order Status tab keeps working off
// the manual Ordered checkbox in the meantime.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GMAIL_CLIENT_ID')!,
      client_secret: Deno.env.get('GMAIL_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GMAIL_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${data.error_description || data.error || res.status}`);
  return data.access_token;
}

function headerValue(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

const POLL_STATE_ID = 'hello@itsrecess.com.au';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Runs with the service role -- it's the only writer for these two
    // tables, and reads across every org's supplier_metadata (there's
    // no per-request org context here; this is a cron job, not a user).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Only suppliers an admin has given a match pattern to are ever
    // auto-confirmed -- everyone else keeps using the manual checkbox.
    const { data: metadata, error: metaError } = await supabase
      .from('supplier_metadata')
      .select('org_id, supplier, confirmation_email_match')
      .not('confirmation_email_match', 'is', null);
    if (metaError) throw metaError;
    if (!metadata || metadata.length === 0) {
      return jsonResponse({ checked: 0, matched: 0, note: 'No suppliers configured for email confirmation.' });
    }

    const { data: pollState } = await supabase
      .from('gmail_poll_state')
      .select('last_checked')
      .eq('id', POLL_STATE_ID)
      .maybeSingle();
    const sinceEpoch = pollState?.last_checked
      ? Math.floor(new Date(pollState.last_checked).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 86400; // first run: look back 1 day

    const accessToken = await getAccessToken();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`after:${sinceEpoch}`)}`,
      { headers: authHeaders }
    );
    const listData = await listRes.json();
    if (!listRes.ok) throw new Error(`Gmail list failed: ${listData.error?.message || listRes.status}`);

    const messages: { id: string }[] = listData.messages || [];
    let matchedCount = 0;

    for (const { id: messageId } of messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: authHeaders }
      );
      const msg = await msgRes.json();
      if (!msgRes.ok) { console.error('Gmail get failed for', messageId, msg); continue; }

      const from = headerValue(msg.payload?.headers || [], 'From').toLowerCase();
      const subject = headerValue(msg.payload?.headers || [], 'Subject');
      if (!from) continue;

      const match = metadata.find(m => from.includes(String(m.confirmation_email_match).toLowerCase()));
      if (!match) continue;

      const { error: insertError } = await supabase
        .from('supplier_order_confirmations')
        .upsert([{
          org_id: match.org_id,
          supplier: match.supplier,
          gmail_message_id: messageId,
          from_address: from,
          subject,
          received_at: new Date(Number(msg.internalDate)).toISOString(),
        }], { onConflict: 'org_id,gmail_message_id' });
      if (insertError) console.error('Failed to record confirmation:', insertError);
      else matchedCount++;
    }

    await supabase
      .from('gmail_poll_state')
      .upsert([{ id: POLL_STATE_ID, last_checked: new Date().toISOString() }]);

    return jsonResponse({ checked: messages.length, matched: matchedCount });
  } catch (err) {
    console.error('check-order-confirmations error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
