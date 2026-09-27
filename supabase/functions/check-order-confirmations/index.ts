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
// Matching is two-tier because some suppliers are ordered directly
// (Bidfood emails from its own address -- a From match is enough) while
// others go through a marketplace that emails from the SAME address for
// every supplier it routes (FoodByUs, Fresho) -- for those,
// confirmation_body_match additionally requires the supplier's own name
// to appear in the email body, so one FoodByUs "order placed" email can
// correctly confirm just the supplier(s) it actually lists, and a single
// email can confirm more than one supplier if its body names several.
//
// Requires three secrets set in the Supabase project (Edge Functions ->
// Secrets), from a one-time Google Cloud OAuth setup for
// hello@itsrecess.com.au done outside this codebase:
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

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

// Gmail message payloads are either a single part (mimeType directly on
// the payload) or nested multipart/* trees -- walk either shape and
// collect every text/plain and text/html part found anywhere in it.
function collectParts(part: any, acc: { plain: string[]; html: string[] }) {
  if (!part) return;
  if (part.mimeType === 'text/plain' && part.body?.data) acc.plain.push(decodeBase64Url(part.body.data));
  else if (part.mimeType === 'text/html' && part.body?.data) acc.html.push(decodeBase64Url(part.body.data));
  if (Array.isArray(part.parts)) for (const sub of part.parts) collectParts(sub, acc);
}

function extractBodyText(payload: any): string {
  const acc = { plain: [] as string[], html: [] as string[] };
  collectParts(payload, acc);
  if (acc.plain.length > 0) return acc.plain.join('\n');
  if (acc.html.length > 0) return stripHtml(acc.html.join('\n'));
  return '';
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
      .select('org_id, supplier, confirmation_email_match, confirmation_body_match')
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
      // Metadata first (cheap) -- only fetch the full body below if a
      // From match actually needs disambiguating against it.
      const metaRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: authHeaders }
      );
      const metaMsg = await metaRes.json();
      if (!metaRes.ok) { console.error('Gmail get (metadata) failed for', messageId, metaMsg); continue; }

      const from = headerValue(metaMsg.payload?.headers || [], 'From').toLowerCase();
      const subject = headerValue(metaMsg.payload?.headers || [], 'Subject');
      if (!from) continue;

      const fromCandidates = metadata.filter(m => from.includes(String(m.confirmation_email_match).toLowerCase()));
      if (fromCandidates.length === 0) continue;

      const needsBody = fromCandidates.some(m => m.confirmation_body_match);
      let matches = fromCandidates;
      if (needsBody) {
        const fullRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          { headers: authHeaders }
        );
        const fullMsg = await fullRes.json();
        if (!fullRes.ok) { console.error('Gmail get (full) failed for', messageId, fullMsg); continue; }
        const bodyText = extractBodyText(fullMsg.payload).toLowerCase();
        matches = fromCandidates.filter(m => !m.confirmation_body_match || bodyText.includes(String(m.confirmation_body_match).toLowerCase()));
      }
      if (matches.length === 0) continue;

      const receivedAt = new Date(Number(metaMsg.internalDate)).toISOString();
      for (const match of matches) {
        const { error: insertError } = await supabase
          .from('supplier_order_confirmations')
          .upsert([{
            org_id: match.org_id,
            supplier: match.supplier,
            gmail_message_id: messageId,
            from_address: from,
            subject,
            received_at: receivedAt,
          }], { onConflict: 'org_id,supplier,gmail_message_id' });
        if (insertError) console.error('Failed to record confirmation:', insertError);
        else matchedCount++;
      }
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
