import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Sends the 8pm (Australia/Sydney) order-status summary to
// hello@itsrecess.com.au: either an all-clear ("every order that needed
// placing today has been") or a flag naming exactly which suppliers still
// need one. Triggered by pg_cron + pg_net -- see
// supabase_stock_order_status_email_schedule.sql, which self-gates to the
// 20:00 Sydney hour so this only ever fires once a day regardless of DST.
//
// Requires a verified sending domain in Resend (resend.com/domains) --
// until itsrecess.com.au (or another domain) is verified there, the
// `from` address below is rejected and no email goes out. The cron
// schedule and this function are otherwise fully live.
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

// Brand tokens -- same orange as R-Stock's own [data-theme="stock"] palette
// in index.css, so the email reads as the same product, not a generic
// system notification.
const BRAND = '#E85018';
const BRAND_DARK = '#C94410';
const GOOD = '#0f9d4e';
const BAD = '#d0393b';
const GOOD_BG = '#EAF7EF';
const BAD_BG = '#FDECEC';

function locationSectionHtml(locationName: string, statuses: SupplierStatus[]): string {
  const outstanding = statuses.filter(s => !s.allPlaced);
  const placed = statuses.filter(s => s.allPlaced);
  const allClear = outstanding.length === 0;

  if (statuses.length === 0) {
    return `
    <tr><td style="padding:14px 20px;border-bottom:1px solid #F1F5F9">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;font-weight:700;color:#1E293B;width:1%;white-space:nowrap;padding-right:10px">${locationName}</td>
        <td style="font-size:13px;color:#94A3B8">Nothing needed ordering today</td>
      </tr></table>
    </td></tr>`;
  }

  const outstandingRows = outstanding.map(s => `
    <tr>
      <td style="padding:9px 20px;border-left:3px solid ${BAD};background:${BAD_BG}">
        <div style="font-size:13px;font-weight:700;color:#1E293B">${s.supplier}</div>
        <div style="font-size:12px;color:#64748B;margin-top:1px">${s.outstandingItems.join(', ')}</div>
      </td>
    </tr>`).join('');

  const placedChips = placed.map(s => `
    <span style="display:inline-block;font-size:11px;color:#475569;background:#F8FAFC;border:1px solid #EEF2F6;border-radius:999px;padding:3px 10px;margin:0 6px 6px 0">
      ${s.supplier}${s.isConfirmed ? ` <span style="color:${GOOD};font-weight:700">&#10003;</span>` : ''}
    </span>`).join('');

  return `
  <tr><td style="padding:16px 20px 6px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:#94A3B8">${locationName}</td>
      <td align="right" style="font-size:11px;font-weight:700;color:${allClear ? GOOD : BAD}">
        ${allClear ? 'All placed' : `${outstanding.length} outstanding`}
      </td>
    </tr></table>
  </td></tr>
  ${outstandingRows ? `<tr><td style="padding:0 20px 4px"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 6px">${outstandingRows}</table></td></tr>` : ''}
  ${placedChips ? `<tr><td style="padding:2px 20px 4px">${placedChips}</td></tr>` : ''}
  `;
}

function buildEmailHtml(dateLabel: string, totalOutstanding: number, sections: string[]): string {
  const allClear = totalOutstanding === 0;
  const heroColor = allClear ? GOOD : BAD;
  const heroBg = allClear ? GOOD_BG : BAD_BG;
  const heroIcon = allClear ? '&#10003;' : '!';
  const heroHeadline = allClear
    ? 'All orders placed'
    : `${totalOutstanding} supplier${totalOutstanding !== 1 ? 's' : ''} still need${totalOutstanding === 1 ? 's' : ''} ordering`;
  const heroSub = allClear
    ? 'Every order that needed placing today has been.'
    : 'Scroll down for exactly which ones, and what.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>R-Stock Order Status -- ${dateLabel}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:28px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%">

        <!-- Brand header -->
        <tr>
          <td style="background:${BRAND};background:linear-gradient(135deg,${BRAND},${BRAND_DARK});border-radius:14px 14px 0 0;padding:22px 24px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="width:40px;vertical-align:middle">
                <table cellpadding="0" cellspacing="0" width="36" height="36" style="background:rgba(255,255,255,0.18);border-radius:10px">
                  <tr><td align="center" valign="middle" style="font-size:18px;line-height:36px;height:36px">&#128230;</td></tr>
                </table>
              </td>
              <td style="vertical-align:middle;padding-left:4px">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75)">R-Stock &middot; Order Status</div>
                <div style="font-size:19px;font-weight:800;color:#ffffff;margin-top:1px">${dateLabel}, 8:00pm</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Hero verdict -->
        <tr>
          <td style="background:${heroBg};padding:20px 24px;border-left:1px solid #F1F5F9;border-right:1px solid #F1F5F9">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:34px;vertical-align:top">
                <table cellpadding="0" cellspacing="0" width="28" height="28" style="background:${heroColor};border-radius:999px">
                  <tr><td align="center" valign="middle" style="font-size:15px;font-weight:800;color:#ffffff;line-height:28px;height:28px">${heroIcon}</td></tr>
                </table>
              </td>
              <td style="vertical-align:top;padding-left:4px">
                <div style="font-size:18px;font-weight:800;color:${heroColor}">${heroHeadline}</div>
                <div style="font-size:12px;color:#64748B;margin-top:2px">${heroSub}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Per-location detail -->
        <tr>
          <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none;border-radius:0 0 14px 14px;padding-bottom:10px">
            <table width="100%" cellpadding="0" cellspacing="0">${sections.join('')}</table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 4px 0;text-align:center">
            <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:${BRAND};margin-right:6px;vertical-align:middle"></span>
            <span style="font-size:11px;color:#94A3B8;vertical-align:middle">R-Stock, part of Recess Roster</span>
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
      from: 'R-Stock <order-status@itsrecess.com.au>', // requires itsrecess.com.au verified at resend.com/domains
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
      let totalOutstanding = 0;
      for (const loc of locations) {
        const locSites = (sites || []).filter((s: any) => s.location_id === loc.id) as SiteRow[];
        const statuses = computeSupplierStatuses(locSites, itemNameById, confirmedAtBySupplier, today);
        totalOutstanding += statuses.filter(s => !s.allPlaced).length;
        sections.push(locationSectionHtml(loc.name, statuses));
      }

      const subject = totalOutstanding > 0
        ? `⚠️ Order status: some orders still need placing -- ${dateLabel}`
        : `✅ All orders placed -- ${dateLabel}`;
      const html = buildEmailHtml(dateLabel, totalOutstanding, sections);
      await sendEmail(subject, html);
      emailsSent++;
    }

    return jsonResponse({ emailsSent });
  } catch (err) {
    console.error('send-order-status-email error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
