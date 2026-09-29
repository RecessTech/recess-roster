import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Sends the 8pm (Australia/Sydney) order-status summary to
// hello@itsrecess.com.au: either an all-clear ("every order that needed
// placing today has been") or a flag naming exactly which suppliers still
// need one. Triggered by pg_cron + pg_net -- see
// supabase_stock_order_status_email_migration.sql, which self-gates to the
// 20:00 Sydney hour so this only ever fires once a day regardless of DST.
//
// Mirrors the same per-supplier status logic as the Order Status tab
// (StockApp.jsx's OrderStatusTab): a supplier is outstanding if it has any
// item currently low/out/order_moq, not marked Ordered, and not deferred
// past today. "Confirmed" (vs just self-reported Placed) reuses
// supplier_order_confirmations, written by check-order-confirmations.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const NEEDS_ORDER_STATUSES = ['no_stock', 'low_stock', 'order_moq'];
const ORDER_STATUS_RECIPIENT = 'hello@itsrecess.com.au';

// Sydney-local calendar date (en-CA formats as YYYY-MM-DD) -- this function
// runs on UTC, and comparing deferred_until against a UTC date would drift
// a day out of step with the app, which always compares against the
// browser's local (Sydney) date.
function sydneyDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);
}

interface SiteRow {
  item_id: string;
  location_id: string;
  supplier: string | null;
  current_status: string;
  ordered: boolean;
  ordered_at: string | null;
  deferred_until: string | null;
}

interface SupplierStatus {
  supplier: string;
  allPlaced: boolean;
  isConfirmed: boolean;
  outstandingItems: string[];
  placedCount: number;
}

function computeSupplierStatuses(
  rows: SiteRow[],
  itemNameById: Map<string, string>,
  confirmedAtBySupplier: Map<string, number>,
  today: string
): SupplierStatus[] {
  const isDeferred = (r: SiteRow) => !!r.deferred_until && r.deferred_until >= today;

  const groups = new Map<string, SiteRow[]>();
  for (const r of rows) {
    const supplier = r.supplier || 'No Supplier';
    if (!groups.has(supplier)) groups.set(supplier, []);
    groups.get(supplier)!.push(r);
  }

  const result: SupplierStatus[] = [];
  for (const [supplier, supplierRows] of groups) {
    const stockLow = supplierRows.filter(r => NEEDS_ORDER_STATUSES.includes(r.current_status));
    const needsOrder = stockLow.filter(r => !isDeferred(r));
    if (needsOrder.length === 0) continue; // nothing outstanding for this supplier today

    const notOrdered = needsOrder.filter(r => !r.ordered);
    const ordered = needsOrder.filter(r => r.ordered);
    const allPlaced = notOrdered.length === 0;

    const orderedAts = ordered.filter(r => r.ordered_at).map(r => new Date(r.ordered_at!).getTime());
    const latestOrderedAt = orderedAts.length > 0 ? Math.max(...orderedAts) : null;
    const confirmedAt = confirmedAtBySupplier.get(supplier) ?? null;
    const isConfirmed = allPlaced && latestOrderedAt != null && confirmedAt != null && confirmedAt >= latestOrderedAt;

    result.push({
      supplier,
      allPlaced,
      isConfirmed,
      outstandingItems: notOrdered.map(r => itemNameById.get(r.item_id) || 'Unknown item'),
      placedCount: ordered.length,
    });
  }
  return result.sort((a, b) => a.supplier.localeCompare(b.supplier));
}

function locationSectionHtml(locationName: string, statuses: SupplierStatus[]): string {
  const outstanding = statuses.filter(s => !s.allPlaced);
  const placed = statuses.filter(s => s.allPlaced);
  const allClear = outstanding.length === 0;

  const bannerColor = allClear ? '#0f9d4e' : '#d0393b';
  const bannerBg = allClear ? '#EAF7EF' : '#FDECEC';
  const bannerText = statuses.length === 0
    ? 'Nothing needed ordering today'
    : allClear
    ? 'All orders placed'
    : `${outstanding.length} supplier${outstanding.length !== 1 ? 's' : ''} still need${outstanding.length === 1 ? 's' : ''} ordering`;

  const outstandingHtml = outstanding.map(s => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #F1F5F9">
        <div style="font-size:13px;font-weight:700;color:#1E293B">${s.supplier}</div>
        <div style="font-size:12px;color:#64748B;margin-top:2px">${s.outstandingItems.join(', ')}</div>
      </td>
    </tr>`).join('');

  const placedHtml = placed.map(s => `
    <span style="display:inline-block;font-size:12px;color:#64748B;margin:0 10px 4px 0">
      ${s.supplier}${s.isConfirmed ? ' <span style="color:#0f9d4e">(confirmed)</span>' : ''}
    </span>`).join('');

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;margin-bottom:20px">
    <tr>
      <td style="background:${bannerBg};border-radius:10px 10px ${outstanding.length || placed.length ? '0 0' : '10px 10px'};padding:14px 16px">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${bannerColor}">${locationName}</div>
        <div style="font-size:16px;font-weight:700;color:${bannerColor};margin-top:2px">${bannerText}</div>
      </td>
    </tr>
    ${outstanding.length > 0 ? `
    <tr>
      <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none">
        <table width="100%" cellpadding="0" cellspacing="0">${outstandingHtml}</table>
      </td>
    </tr>` : ''}
    ${placed.length > 0 ? `
    <tr>
      <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:${outstanding.length ? '1px solid #F1F5F9' : 'none'};border-radius:0 0 10px 10px;padding:12px 16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;margin-bottom:6px">Already placed</div>
        ${placedHtml}
      </td>
    </tr>` : ''}
  </table>`;
}

function buildEmailHtml(dateLabel: string, sections: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Order status -- ${dateLabel}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">
        <tr>
          <td style="padding:0 0 16px">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94A3B8">Order Status</div>
            <div style="font-size:20px;font-weight:700;color:#1E293B;margin-top:2px">${dateLabel}, 8:00pm</div>
          </td>
        </tr>
        <tr><td>${sections.join('')}</td></tr>
        <tr>
          <td style="padding:8px 0 0;text-align:center;font-size:11px;color:#94A3B8">
            Sent by R-Stock via Recess Roster
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'R-Stock <order-status@recesstech.com.au>',
      to: [ORDER_STATUS_RECIPIENT],
      subject,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend rejected the request: ${data.message || data.name || res.status}`);
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = sydneyDateStr();
    const dateLabel = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric' });

    // Single-tenant in practice, but this loops every org with active
    // locations rather than hardcoding one -- same reasoning as
    // check-order-confirmations.
    const { data: orgRows, error: orgErr } = await supabase.from('locations').select('org_id').eq('active', true);
    if (orgErr) throw orgErr;
    const orgIds = [...new Set((orgRows || []).map(r => r.org_id))];

    let emailsSent = 0;
    for (const orgId of orgIds) {
      const [{ data: locations }, { data: sites }, { data: items }, { data: confirmations }] = await Promise.all([
        supabase.from('locations').select('id, name').eq('org_id', orgId).eq('active', true),
        supabase.from('stock_item_sites').select('item_id, location_id, supplier, current_status, ordered, ordered_at, deferred_until').eq('org_id', orgId),
        supabase.from('stock_items').select('id, name').eq('org_id', orgId),
        supabase.from('supplier_order_confirmations').select('supplier, received_at').eq('org_id', orgId),
      ]);
      if (!locations || locations.length === 0) continue;

      const itemNameById = new Map((items || []).map((i: any) => [i.id, i.name]));
      const confirmedAtBySupplier = new Map<string, number>();
      for (const c of confirmations || []) {
        const t = new Date(c.received_at).getTime();
        const prev = confirmedAtBySupplier.get(c.supplier);
        if (prev == null || t > prev) confirmedAtBySupplier.set(c.supplier, t);
      }

      const sections: string[] = [];
      let anyOutstanding = false;
      for (const loc of locations) {
        const locSites = (sites || []).filter((s: any) => s.location_id === loc.id) as SiteRow[];
        const statuses = computeSupplierStatuses(locSites, itemNameById, confirmedAtBySupplier, today);
        if (statuses.some(s => !s.allPlaced)) anyOutstanding = true;
        sections.push(locationSectionHtml(loc.name, statuses));
      }

      const subject = anyOutstanding
        ? `⚠️ Order status: some orders still need placing -- ${dateLabel}`
        : `✅ All orders placed -- ${dateLabel}`;
      const html = buildEmailHtml(dateLabel, sections);
      await sendEmail(subject, html);
      emailsSent++;
    }

    return jsonResponse({ emailsSent });
  } catch (err) {
    console.error('send-order-status-email error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
