import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Alerts hello@itsrecess.com.au whenever a catering job due within the
// next 3 days still has one of its 4 admin checkboxes (Confirmed,
// Invoiced, Bread Ordered, Delivery Booked) unticked. Triggered by
// pg_cron + pg_net -- see
// supabase_catering_checklist_alert_email_schedule.sql, which self-gates
// to a single Sydney-local hour so this only ever fires once a day
// regardless of DST. Mirrors send-order-status-email's structure, but
// only sends when something is actually outstanding -- this is an alert,
// not a daily digest, so an all-clear day sends nothing.
//
// A job keeps appearing in this alert every day it's within the 3-day
// window and still missing a checkbox, not just once at exactly 3 days
// out -- a single point-in-time nudge is too easy to miss.
//
// Requires a verified sending domain in Resend (resend.com/domains) --
// until itsrecess.com.au is verified there, the `from` address below is
// rejected and no email goes out.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const ALERT_RECIPIENT = 'hello@itsrecess.com.au';
const DAYS_OUT = 3;

const CHECKBOX_FIELDS: Array<{ key: 'confirmed' | 'invoiced' | 'bread_ordered' | 'delivery_booked'; label: string }> = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'bread_ordered', label: 'Bread Ordered' },
  { key: 'delivery_booked', label: 'Delivery Booked' },
];

// Sydney-local calendar date (en-CA formats as YYYY-MM-DD) -- this
// function runs on UTC, and comparing job_date against a UTC date would
// drift a day out of step with the app, which always compares against
// the browser's local (Sydney) date.
function sydneyDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

interface CateringJobRow {
  id: string;
  job_date: string;
  company: string | null;
  contact: string | null;
  ready_by: string | null;
  confirmed: boolean;
  invoiced: boolean;
  bread_ordered: boolean;
  delivery_booked: boolean;
}

function dayLabel(jobDateStr: string, todayStr: string): string {
  if (jobDateStr === todayStr) return 'Today';
  if (jobDateStr === addDaysStr(todayStr, 1)) return 'Tomorrow';
  return new Date(jobDateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

// Brand tokens -- R-Shift's blue colourway, same as send-order-status-email.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
const BAD = '#d0393b';
const BAD_BG = '#FDECEC';

function jobRowHtml(job: CateringJobRow, todayStr: string): string {
  const missing = CHECKBOX_FIELDS.filter(f => !job[f.key]);
  const name = job.company || job.contact || 'Untitled job';
  const subLabel = [job.company && job.contact ? job.contact : null, job.ready_by].filter(Boolean).join(' · ');
  return `
  <tr>
    <td style="padding:10px 20px;border-left:3px solid ${BAD};background:${BAD_BG}">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;font-weight:700;color:#94A3B8;width:1%;white-space:nowrap;padding-right:12px;vertical-align:top">${dayLabel(job.job_date, todayStr)}</td>
        <td>
          <div style="font-size:13px;font-weight:700;color:#1E293B">${name}</div>
          ${subLabel ? `<div style="font-size:12px;color:#64748B;margin-top:1px">${subLabel}</div>` : ''}
          <div style="font-size:12px;color:${BAD};font-weight:600;margin-top:3px">Missing: ${missing.map(f => f.label).join(', ')}</div>
        </td>
      </tr></table>
    </td>
  </tr>`;
}

function buildEmailHtml(dateLabel: string, jobs: CateringJobRow[], todayStr: string): string {
  const rows = jobs.map(j => jobRowHtml(j, todayStr)).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>R-Cater Checklist Alert -- ${dateLabel}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:28px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%">

        <!-- Brand header -->
        <tr>
          <td style="background:${BRAND};background:linear-gradient(160deg,${BRAND},${BRAND_DARK});border-radius:14px 14px 0 0;padding:22px 24px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75)">R-Cater &middot; Checklist Alert</div>
            <div style="font-size:19px;font-weight:800;color:#ffffff;margin-top:1px">${dateLabel}</div>
          </td>
        </tr>

        <!-- Hero verdict -->
        <tr>
          <td style="background:${BAD_BG};padding:20px 24px;border-left:1px solid #F1F5F9;border-right:1px solid #F1F5F9">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="width:34px;vertical-align:top">
                <table cellpadding="0" cellspacing="0" width="28" height="28" style="background:${BAD};border-radius:999px">
                  <tr><td align="center" valign="middle" style="font-size:15px;font-weight:800;color:#ffffff;line-height:28px;height:28px">!</td></tr>
                </table>
              </td>
              <td style="vertical-align:top;padding-left:4px">
                <div style="font-size:18px;font-weight:800;color:${BAD}">${jobs.length} job${jobs.length !== 1 ? 's' : ''} due within ${DAYS_OUT} days still need${jobs.length === 1 ? 's' : ''} action</div>
                <div style="font-size:12px;color:#64748B;margin-top:2px">Confirmed / Invoiced / Bread Ordered / Delivery Booked -- see exactly what's missing below.</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Job list -->
        <tr>
          <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none;border-radius:0 0 14px 14px;padding:12px 0">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 8px">${rows}</table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 4px 0;text-align:center">
            <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:${BRAND};margin-right:6px;vertical-align:middle"></span>
            <span style="font-size:11px;color:#94A3B8;vertical-align:middle">R-Cater</span>
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
      from: 'R-Cater <catering-alert@itsrecess.com.au>', // requires itsrecess.com.au verified at resend.com/domains
      to: [ALERT_RECIPIENT],
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
    const cutoff = addDaysStr(today, DAYS_OUT);
    const dateLabel = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', year: 'numeric' });

    // Single-tenant in practice, but this loops every org with catering
    // jobs rather than hardcoding one -- same reasoning as
    // send-order-status-email.
    const { data: jobRows, error: jobErr } = await supabase
      .from('catering_jobs')
      .select('id, org_id, job_date, company, contact, ready_by, confirmed, invoiced, bread_ordered, delivery_booked')
      .gte('job_date', today)
      .lte('job_date', cutoff)
      .order('job_date', { ascending: true })
      .order('ready_by', { ascending: true, nullsFirst: false });
    if (jobErr) throw jobErr;

    const outstandingByOrg = new Map<string, CateringJobRow[]>();
    for (const j of jobRows || []) {
      if (j.confirmed && j.invoiced && j.bread_ordered && j.delivery_booked) continue;
      if (!outstandingByOrg.has(j.org_id)) outstandingByOrg.set(j.org_id, []);
      outstandingByOrg.get(j.org_id)!.push(j);
    }

    let emailsSent = 0;
    for (const [, jobs] of outstandingByOrg) {
      const subject = `⚠️ ${jobs.length} catering job${jobs.length !== 1 ? 's' : ''} still need${jobs.length === 1 ? 's' : ''} action -- ${dateLabel}`;
      const html = buildEmailHtml(dateLabel, jobs, today);
      await sendEmail(subject, html);
      emailsSent++;
    }

    return jsonResponse({ emailsSent, jobsFlagged: [...outstandingByOrg.values()].reduce((s, j) => s + j.length, 0) });
  } catch (err) {
    console.error('send-catering-checklist-alert error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
