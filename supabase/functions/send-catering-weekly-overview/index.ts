import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Sunday 6pm (Australia/Sydney) "week ahead" overview -- every catering job
// booked for the coming Monday-Sunday week, grouped by day. Sent every
// week regardless of whether anything is booked (an empty week is still
// useful to know about), unlike send-catering-daily-overview below, which
// stays silent on a day with nothing on. Triggered by pg_cron + pg_net --
// see supabase_catering_weekly_overview_email_schedule.sql, which
// self-gates to Sunday 18:00 Sydney time.

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
const MUTED_BG = '#F1F5F9';
const MUTED_TEXT = '#94A3B8';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sydneyDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(d);
}
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dowOf(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0=Sun .. 6=Sat
}
// The next Monday strictly after dateStr -- works whether this runs on its
// scheduled Sunday evening or is invoked manually on some other day for a
// test send.
function nextMonday(dateStr: string): string {
  let d = dateStr;
  for (let i = 0; i < 7; i++) {
    d = addDaysStr(d, 1);
    if (dowOf(d) === 1) return d;
  }
  return d;
}
function ddmm(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  job_date: string;
  company: string | null;
  contact: string | null;
  ready_by: string | null;
  job_type: string | null;
  platter_size: number | null;
  pieces_per_person: string | null;
  salads: string | null;
}

function jobLineHtml(job: CateringJobRow): string {
  const name = job.company || job.contact || 'Untitled job';
  const bits = [
    job.ready_by,
    job.platter_size ? `${job.platter_size} ppl` : null,
    job.salads,
    job.job_type,
  ].filter(Boolean).join(' · ');
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
    <tr>
      <td style="padding:8px 12px;background:#F8FAFC;border-radius:8px">
        <div style="font-size:13px;font-weight:700;color:#1E293B">${name}</div>
        ${bits ? `<div style="font-size:11.5px;color:#64748B;margin-top:1px">${bits}</div>` : ''}
      </td>
    </tr>
  </table>`;
}

function dayBlockHtml(dateStr: string, jobs: CateringJobRow[]): string {
  const dow = dowOf(dateStr);
  const jobsHtml = jobs.length > 0
    ? jobs.map(jobLineHtml).join('')
    : `<div style="font-size:12.5px;color:${MUTED_TEXT};font-style:italic;margin-top:6px">No jobs booked</div>`;
  return `
  <tr>
    <td style="padding:14px 20px;border-top:1px solid #F1F5F9">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;font-weight:800;color:#1E293B">${DAY_NAME[dow]}</td>
        <td align="right" style="font-size:11.5px;color:${MUTED_TEXT}">${ddmm(dateStr)}</td>
      </tr></table>
      ${jobsHtml}
    </td>
  </tr>`;
}

function buildEmailHtml(weekStart: string, weekEnd: string, jobsByDay: Map<string, CateringJobRow[]>, totalJobs: number): string {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDaysStr(weekStart, i));
  const dayBlocks = days.map(d => dayBlockHtml(d, jobsByDay.get(d) || [])).join('');

  const heroColor = totalJobs === 0 ? MUTED_TEXT : BRAND;
  const heroBg = totalJobs === 0 ? '#F8FAFC' : '#EEF2FF';
  const heroHeadline = totalJobs === 0
    ? 'No catering jobs booked this week'
    : `${totalJobs} catering job${totalJobs !== 1 ? 's' : ''} this week`;

  const viewUrl = `${APP_URL}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Catering Week Ahead -- ${ddmm(weekStart)} to ${ddmm(weekEnd)}</title>
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
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75)">R-Shift &middot; Week Ahead</div>
                <div style="font-size:19px;font-weight:800;color:#ffffff;margin-top:1px">Catering: ${ddmm(weekStart)} - ${ddmm(weekEnd)}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Hero verdict -->
        <tr>
          <td style="background:${heroBg};padding:18px 24px;border-left:1px solid #F1F5F9;border-right:1px solid #F1F5F9">
            <div style="font-size:16px;font-weight:800;color:${heroColor}">${heroHeadline}</div>
          </td>
        </tr>

        <!-- Day-by-day -->
        <tr>
          <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none;padding:0 0 4px">
            <table width="100%" cellpadding="0" cellspacing="0">${dayBlocks}</table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none;border-radius:0 0 14px 14px;padding:4px 24px 22px">
            <a href="${viewUrl}" style="display:block;text-align:center;background:${BRAND};color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;padding:12px 0;border-radius:10px">
              Open R-Shift →
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

  try {
    const body = await req.json().catch(() => ({}));
    const test_to: string | undefined = body?.test_to;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = sydneyDateStr();
    const weekStart = nextMonday(today);
    const weekEnd = addDaysStr(weekStart, 6);

    const { data: jobRows, error: jobErr } = await supabase
      .from('catering_jobs')
      .select('job_date, company, contact, ready_by, job_type, platter_size, pieces_per_person, salads')
      .gte('job_date', weekStart)
      .lte('job_date', weekEnd)
      .order('job_date', { ascending: true })
      .order('ready_by', { ascending: true, nullsFirst: false });
    if (jobErr) throw jobErr;

    const jobsByDay = new Map<string, CateringJobRow[]>();
    for (const j of jobRows || []) {
      if (!jobsByDay.has(j.job_date)) jobsByDay.set(j.job_date, []);
      jobsByDay.get(j.job_date)!.push(j);
    }
    const totalJobs = (jobRows || []).length;

    const html = buildEmailHtml(weekStart, weekEnd, jobsByDay, totalJobs);
    const subject = `[W${isoWeek(weekStart)}] Catering Week Ahead - ${ddmm(weekStart)} to ${ddmm(weekEnd)}`;

    const to = test_to ? [test_to] : RECIPIENTS;
    const data = await sendEmail(subject, html, to);

    return jsonResponse({ success: true, id: data.id, jobsThisWeek: totalJobs, weekStart, weekEnd });
  } catch (err) {
    console.error('send-catering-weekly-overview error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
