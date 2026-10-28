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
// Each genuinely NEW confirmation (see supabase_stock_order_confirmation_
// automation.sql) also:
//   1. Auto-marks ordered=true on every currently-outstanding (needs-order,
//      not deferred, not already ordered) stock_item_sites row for that
//      supplier, across every location -- the receipt is itself proof the
//      order went in, so staff shouldn't also have to remember to tick the
//      box. (A confirmation isn't location-specific, same as the Order
//      Status tab already assumes.)
//   2. Best-effort regex-extracts a $ total from the email body
//      (invoice_total) and sums order_qty * cost_per_uom across the rows
//      just auto-marked (expected_total), so a gross pricing error shows
//      up as a variance instead of only in the P&L weeks later.
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

// Best-effort only -- supplier receipt formats vary wildly, so this just
// looks for the LAST "(grand/order) total ... $X.XX" line, on the theory
// that a grand total usually comes after any itemized subtotals/GST line
// in a receipt. Returns null rather than guess when nothing matches.
function extractInvoiceTotal(bodyText: string): number | null {
  const regex = /(?:grand\s+|order\s+)?total(?:\s*\(?incl?\.?\s*gst\)?)?\s*[:\-]?\s*\$\s*([\d,]+\.\d{2})/gi;
  let match: RegExpExecArray | null;
  let last: number | null = null;
  while ((match = regex.exec(bodyText)) !== null) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val)) last = val;
  }
  return last;
}

function sydneyDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);
}

const NEEDS_ORDER_STATUSES = ['no_stock', 'low_stock', 'order_moq'];

// Auto-marks every currently-outstanding row for this supplier as ordered,
// and computes a best-effort expected $ total for what was just marked.
// Returns how many rows were touched and how many of those had a cost to
// sum, so the caller can decide whether expected_total is trustworthy
// enough to compare against the invoice.
async function autoMarkOrderedForSupplier(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  supplier: string,
  orderedAt: string
): Promise<{ autoMarkedCount: number; pricedItemCount: number; expectedTotal: number | null }> {
  const today = sydneyDateStr();

  const { data: rows, error } = await supabase
    .from('stock_item_sites')
    .select('id, item_id, order_qty, reference_order_qty, deferred_until, stock_items ( cost_per_uom )')
    .eq('org_id', orgId)
    .eq('supplier', supplier)
    .eq('ordered', false)
    .in('current_status', NEEDS_ORDER_STATUSES);
  if (error) throw error;

  const outstanding = (rows || []).filter((r: any) => !(r.deferred_until && r.deferred_until >= today));
  if (outstanding.length === 0) return { autoMarkedCount: 0, pricedItemCount: 0, expectedTotal: null };

  const { error: updateError } = await supabase
    .from('stock_item_sites')
    .update({ ordered: true, ordered_at: orderedAt, updated_at: new Date().toISOString() })
    .in('id', outstanding.map((r: any) => r.id));
  if (updateError) throw updateError;

  let pricedItemCount = 0;
  let expectedTotal = 0;
  for (const r of outstanding as any[]) {
    const costPerUom = r.stock_items?.cost_per_uom;
    if (costPerUom == null) continue;
    const qty = r.order_qty ?? r.reference_order_qty ?? 0;
    pricedItemCount++;
    expectedTotal += qty * costPerUom;
  }

  return {
    autoMarkedCount: outstanding.length,
    pricedItemCount,
    expectedTotal: pricedItemCount > 0 ? expectedTotal : null,
  };
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
    let autoMarkedTotal = 0;

    for (const { id: messageId } of messages) {
      // Metadata first (cheap) -- only fetch the full body below if this
      // message actually matched someone's From pattern.
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

      // Full body is fetched for every match now, not just marketplace
      // suppliers needing confirmation_body_match -- it's also where the
      // invoice total gets extracted from, so there's no "cheap path" left
      // to skip it on.
      const fullRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        { headers: authHeaders }
      );
      const fullMsg = await fullRes.json();
      if (!fullRes.ok) { console.error('Gmail get (full) failed for', messageId, fullMsg); continue; }
      const rawBodyText = extractBodyText(fullMsg.payload);
      const bodyText = rawBodyText.toLowerCase();
      const matches = fromCandidates.filter(m => !m.confirmation_body_match || bodyText.includes(String(m.confirmation_body_match).toLowerCase()));
      if (matches.length === 0) continue;

      const invoiceTotal = extractInvoiceTotal(rawBodyText);
      const receivedAt = new Date(Number(metaMsg.internalDate)).toISOString();

      for (const match of matches) {
        // Only a genuinely new confirmation triggers auto-marking/pricing --
        // re-seeing a message (e.g. a re-run over an overlapping poll
        // window) must not re-tick or re-total anything.
        const { data: existing, error: existingError } = await supabase
          .from('supplier_order_confirmations')
          .select('id')
          .eq('org_id', match.org_id)
          .eq('supplier', match.supplier)
          .eq('gmail_message_id', messageId)
          .maybeSingle();
        if (existingError) { console.error('Failed to check existing confirmation:', existingError); continue; }
        if (existing) continue;

        let autoMarkedCount = 0;
        let pricedItemCount = 0;
        let expectedTotal: number | null = null;
        try {
          const result = await autoMarkOrderedForSupplier(supabase, match.org_id, match.supplier, receivedAt);
          autoMarkedCount = result.autoMarkedCount;
          pricedItemCount = result.pricedItemCount;
          expectedTotal = result.expectedTotal;
        } catch (err) {
          console.error('Auto-mark-ordered failed for', match.org_id, match.supplier, err);
        }

        const { error: insertError } = await supabase
          .from('supplier_order_confirmations')
          .insert([{
            org_id: match.org_id,
            supplier: match.supplier,
            gmail_message_id: messageId,
            from_address: from,
            subject,
            received_at: receivedAt,
            invoice_total: invoiceTotal,
            expected_total: expectedTotal,
            auto_marked_count: autoMarkedCount,
            priced_item_count: pricedItemCount,
          }]);
        if (insertError) console.error('Failed to record confirmation:', insertError);
        else { matchedCount++; autoMarkedTotal += autoMarkedCount; }
      }
    }

    await supabase
      .from('gmail_poll_state')
      .upsert([{ id: POLL_STATE_ID, last_checked: new Date().toISOString() }]);

    return jsonResponse({ checked: messages.length, matched: matchedCount, autoMarked: autoMarkedTotal });
  } catch (err) {
    console.error('check-order-confirmations error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
