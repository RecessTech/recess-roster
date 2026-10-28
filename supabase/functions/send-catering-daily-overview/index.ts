import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 6am (Australia/Sydney) same-day overview -- every catering job booked
// for today, with its critical details. Unlike send-catering-weekly-
// overview, this stays completely silent on a day with nothing booked --
// it's a "here's what's on today" nudge, not a daily digest. Triggered by
// pg_cron + pg_net -- see
// supabase_catering_daily_overview_email_schedule.sql, which self-gates
// to the 06:00 Sydney hour so this only ever fires once a day regardless
// of DST.
//
// That SQL-side gate only governs pg_cron's own calls -- this function is
// otherwise a plain public URL (verify_jwt is off, same as every sibling
// alert function), so a stray GET (a link-preview crawler, a health
// check, anyone who finds the URL) could trigger a real send at any hour.
// The method check and the Sydney hour check below are the fix -- real
// protection now lives in the function itself, not just in the SQL
// wrapper that's supposed to be the only caller.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECIPIENTS = [
  'hello@itsrecess.com.au',
  'clark@itsrecess.com.au',
  'sophie.mcnaughtlee@gmail.com',
  'paddyjlevy@gmail.com',
];

const APP_URL = 'https://r-shift-git-main-clark-wenborns-projects.vercel.app';

const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
// Served from the app's own deployment, not a third-party image host --
// postimg.cc (the previous home for this logo) silently deletes hotlinked
// images that go unviewed for a while, which is exactly what broke this
// logo in emails before. This URL is just as permanent as the app itself.
const LOGO_URL = 'https://r-shift-git-main-clark-wenborns-projects.vercel.app/logo192.png';
const TINT = '#EEF2FF';
const TINT_TEXT = '#3730A3';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sydneyDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);
}
// Current Sydney-local hour (0-23) -- the function's own safety check
// against being invoked outside its intended window, independent of and
// in addition to the SQL-side cron gate.
function sydneyHour(d: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Australia/Sydney', hour: 'numeric', hour12: false,
  }).formatToParts(d).find(p => p.type === 'hour')!.value;
  const hour = parseInt(hourStr, 10);
  return hour === 24 ? 0 : hour;
}
function ddmm(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}
const DAY_ABBREV = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function dayAbbrev(dateStr: string): string {
  return DAY_ABBREV[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
}
function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ISO-8601 week number (Monday-start) -- matches the "W42" labels in the
// Catering Hub sheet this data originally came from.
function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

interface CateringJobRow {
  company: string | null;
  contact: string | null;
  job_type: string | null;
  address: string | null;
  ready_by: string | null;
  deliver_by: string | null;
  delivery_method: string | null;
  platter_size: number | null;
  pieces_per_person: string | null;
  salads: string | null;
  notes: string | null;
}

function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<tr>
    <td style="padding:6px 0;font-size:10.5px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;width:110px;vertical-align:top">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#1E293B;font-weight:600">${value}</td>
  </tr>`;
}

function jobCardHtml(job: CateringJobRow): string {
  const name = job.company || job.contact || 'Untitled job';
  const totalPieces = job.platter_size && job.pieces_per_person
    ? Math.round(Number(job.platter_size) * Number(job.pieces_per_person))
    : null;
  const details = [
    detailRow('Ready By', job.ready_by),
    detailRow('Deliver By', job.deliver_by),
    detailRow('Contact', job.contact),
    detailRow('Address', job.address),
    detailRow('Delivery', job.delivery_method),
    detailRow('Platter', job.platter_size ? `${job.platter_size} ppl${totalPieces ? ` · ${totalPieces} pieces` : ''}` : null),
    detailRow('Salads', job.salads),
  ].join('');
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #F1F5F9;border-radius:10px;overflow:hidden">
    <tr><td style="padding:10px 14px;background:${TINT}">
      <div style="font-size:14px;font-weight:800;color:${TINT_TEXT}">${name}</div>
      ${job.job_type ? `<div style="font-size:11.5px;color:${TINT_TEXT};opacity:0.85">${job.job_type}</div>` : ''}
    </td></tr>
    <tr><td style="padding:10px 14px">
      <table cellpadding="0" cellspacing="0" width="100%">${details}</table>
      ${job.notes ? `<div style="margin-top:8px;font-size:12px;color:#475569;background:#FAFBFC;border-radius:8px;padding:8px 10px;white-space:pre-wrap">${job.notes}</div>` : ''}
    </td></tr>
  </table>`;
}

function buildEmailHtml(dateStr: string, jobs: CateringJobRow[], viewUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Catering Today -- ${ddmm(dateStr)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:28px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%">

        <!-- Brand header -->
        <tr>
          <td style="background:${BRAND};background:linear-gradient(160deg,${BRAND},${BRAND_DARK});border-radius:14px 14px 0 0;padding:22px 24px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="width:40px;vertical-align:middle">
                <table cellpadding="0" cellspacing="0" width="36" height="36" style="border-radius:10px;overflow:hidden">
                  <tr><td style="width:36px;height:36px"><img src="${LOGO_URL}" alt="R-Shift" width="36" height="36" style="display:block;width:36px;height:36px;object-fit:cover;border-radius:10px"></td></tr>
                </table>
              </td>
              <td style="vertical-align:middle;padding-left:4px">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75)">R-Shift &middot; Catering Today</div>
                <div style="font-size:19px;font-weight:800;color:#ffffff;margin-top:1px">${fmtDate(dateStr)}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Hero verdict -->
        <tr>
          <td style="background:#EEF2FF;padding:18px 24px;border-left:1px solid #F1F5F9;border-right:1px solid #F1F5F9">
            <div style="font-size:16px;font-weight:800;color:${BRAND}">${jobs.length} catering job${jobs.length !== 1 ? 's' : ''} today</div>
          </td>
        </tr>

        <!-- Jobs -->
        <tr>
          <td style="background:#ffffff;border-left:1px solid #F1F5F9;border-right:1px solid #F1F5F9;padding:4px 20px 16px">
            ${jobs.map(jobCardHtml).join('')}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none;border-radius:0 0 14px 14px;padding:4px 24px 22px">
            <a href="${viewUrl}" style="display:block;text-align:center;background:${BRAND};color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;padding:12px 0;border-radius:10px">
              View today in R-Shift →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 4px 0;text-align:center">
            <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:${BRAND};margin-right:6px;vertical-align:middle"></span>
            <span style="font-size:11px;color:#94A3B8;vertical-align:middle">R-Shift</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(subject: string, html: string, to: string[]) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'R-Cater <catering-alert@itsrecess.com.au>',
      to,
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
  // GET (link-preview crawlers, browser hits, health checks) can never be
  // a legitimate call here -- the cron trigger and manual test sends both
  // POST. Rejecting outright is cheap, effective insurance on top of the
  // hour check below.
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const test_to: string | undefined = body?.test_to;
    // force_date lets a test send pick a specific day (e.g. one that
    // actually has a job booked) instead of always using today.
    const force_date: string | undefined = body?.force_date;

    // A test send (explicit test_to) is always allowed, any time -- it's a
    // deliberate, single-address POST. A real send to the full
    // distribution list only goes out in the actual 6am Sydney window;
    // anything else is treated as a stray/accidental call and skipped
    // rather than sent.
    if (!test_to && sydneyHour() !== 6) {
      return jsonResponse({ skipped: true, reason: 'Not the scheduled 6am Sydney window.' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = force_date || sydneyDateStr();

    const { data: jobRows, error: jobErr } = await supabase
      .from('catering_jobs')
      .select('org_id, company, contact, job_type, address, ready_by, deliver_by, delivery_method, platter_size, pieces_per_person, salads, notes')
      .eq('job_date', today)
      .order('ready_by', { ascending: true, nullsFirst: false });
    if (jobErr) throw jobErr;

    if (!jobRows || jobRows.length === 0) {
      return jsonResponse({ emailSent: false, reason: 'No catering jobs today.', date: today });
    }

    const orgId = jobRows[0].org_id;
    const { data: org } = await supabase
      .from('organisations')
      .select('staff_hub_public_token')
      .eq('id', orgId)
      .single();
    const viewUrl = org?.staff_hub_public_token
      ? `${APP_URL}/cater/${org.staff_hub_public_token}?d=${today}`
      : APP_URL;

    const html = buildEmailHtml(today, jobRows, viewUrl);
    const subject = `[W${isoWeek(today)}-${dayAbbrev(today)}] Catering Today - ${jobRows.length} job${jobRows.length !== 1 ? 's' : ''} ${ddmm(today)}`;

    const to = test_to ? [test_to] : RECIPIENTS;
    const data = await sendEmail(subject, html, to);

    return jsonResponse({ success: true, id: data.id, jobsToday: jobRows.length, date: today });
  } catch (err) {
    console.error('send-catering-daily-overview error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
