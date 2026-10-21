import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// One-pager "heads up" email for a single catering job, sent on demand from
// the "Send Alert" button on a job card in R-Cater -- distinct from
// send-catering-checklist-alert, which is the automatic daily nag about
// unticked checkboxes. This one is a manual, point-in-time summary of a
// job's critical details plus a link into R-Shift's read-only catering
// view so the recipient can see the live record (and anything added since).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fixed distribution list -- this alert isn't addressed per-recipient, it's
// a standing "whoever needs to know about catering jobs" list.
const RECIPIENTS = [
  'hello@itsrecess.com.au',
  'clark@itsrecess.com.au',
  'sophie.mcnaughtlee@gmail.com',
  'paddyjlevy@gmail.com',
];

// The production R-Shift deployment -- there's no app-URL env var or
// custom domain wired up yet, so this is hardcoded the same way
// itsrecess.com.au is hardcoded as the Resend sending domain elsewhere.
const APP_URL = 'https://r-shift-git-main-clark-wenborns-projects.vercel.app';

// Brand tokens -- R-Shift's own blue colourway, shared across every
// R-Shift email (order-status, the roster, this one) so they all read as
// one product rather than each screen inventing its own look.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
// Served from the app's own deployment, not a third-party image host --
// postimg.cc (the previous home for this logo) silently deletes hotlinked
// images that go unviewed for a while, which is exactly what broke this
// logo in emails before. This URL is just as permanent as the app itself.
const LOGO_URL = 'https://r-shift-git-main-clark-wenborns-projects.vercel.app/logo192.png';
const TINT = '#EEF2FF';
const TINT_TEXT = '#3730A3';
const GOOD = '#15803D';
const GOOD_BG = '#DCFCE7';
const MUTED_BG = '#F1F5F9';
const MUTED_TEXT = '#94A3B8';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// dd/mm, matching the "17/10" convention used throughout the Catering Hub
// sheet this job data originally came from.
function ddmm(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

const DAY_ABBREV = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function dayAbbrev(dateStr: string): string {
  return DAY_ABBREV[new Date(dateStr + 'T00:00:00Z').getUTCDay()];
}

// ISO-8601 week number (Monday-start, week 1 contains the year's first
// Thursday) -- matches the "W42" labels in the Catering Hub sheet exactly.
function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

const DIETARY_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'gf_ppl', label: 'GF' },
  { key: 'vego_ppl', label: 'Vego' },
  { key: 'pb_ppl', label: 'Plant-Based' },
  { key: 'dairy_free_ppl', label: 'Dairy Free' },
  { key: 'halal_ppl', label: 'Halal' },
];

const CHECKBOX_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'bread_ordered', label: 'Bread Ordered' },
  { key: 'delivery_booked', label: 'Delivery Booked' },
];

// deno-lint-ignore no-explicit-any
function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<tr>
    <td style="padding:7px 0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;width:120px;vertical-align:top">${label}</td>
    <td style="padding:7px 0;font-size:13.5px;color:#1E293B;font-weight:600">${value}</td>
  </tr>`;
}

// deno-lint-ignore no-explicit-any
function buildEmailHtml(job: any, viewUrl: string): string {
  const totalPieces = job.platter_size && job.pieces_per_person
    ? Math.round(Number(job.platter_size) * Number(job.pieces_per_person))
    : null;

  const dietaryTags = DIETARY_FIELDS.filter(f => Number(job[f.key]) > 0)
    .map(f => `<span style="display:inline-block;background:${TINT};color:${TINT_TEXT};font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;margin:0 6px 6px 0">${f.label}: ${job[f.key]}</span>`)
    .join('');

  const checkboxTags = CHECKBOX_FIELDS
    .map(f => {
      const on = !!job[f.key];
      return `<span style="display:inline-block;background:${on ? GOOD_BG : MUTED_BG};color:${on ? GOOD : MUTED_TEXT};font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;margin:0 6px 6px 0">${on ? '✓' : '—'} ${f.label}</span>`;
    })
    .join('');

  const details = [
    detailRow('Date', fmtDate(job.job_date)),
    detailRow('Ready By', job.ready_by),
    detailRow('Deliver By', job.deliver_by),
    detailRow('Contact', job.contact),
    detailRow('Address', job.address),
    detailRow('Delivery', job.delivery_method),
    detailRow('Platter', job.platter_size ? `${job.platter_size} ppl${totalPieces ? ` · ${totalPieces} pieces` : ''}` : null),
    detailRow('Salads', job.salads),
    detailRow('Gross Rev', job.gross_rev != null ? `$${Number(job.gross_rev).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null),
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Catering Job Alert -- ${job.company || 'Untitled job'}</title>
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
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75)">R-Shift &middot; Catering Alert</div>
                <div style="font-size:19px;font-weight:800;color:#ffffff;margin-top:1px">${job.company || 'Untitled job'}</div>
              </td>
            </tr></table>
            ${job.job_type ? `<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:10px">${job.job_type}</div>` : ''}
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="background:#ffffff;border-left:1px solid #F1F5F9;border-right:1px solid #F1F5F9;padding:20px 24px">
            <table cellpadding="0" cellspacing="0" width="100%">${details}</table>

            ${dietaryTags || checkboxTags ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #F1F5F9">
              ${dietaryTags}
              ${checkboxTags}
            </div>` : ''}

            ${job.notes ? `<div style="margin-top:14px;font-size:12.5px;color:#475569;background:#FAFBFC;border-radius:10px;padding:10px 12px;white-space:pre-wrap">${job.notes}</div>` : ''}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;border:1px solid #F1F5F9;border-top:none;border-radius:0 0 14px 14px;padding:4px 24px 22px">
            <a href="${viewUrl}" style="display:block;text-align:center;background:${BRAND};color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;padding:12px 0;border-radius:10px">
              View this job in R-Shift →
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { job_id, test_to } = await req.json();
    if (!job_id) return jsonResponse({ error: 'Missing job_id' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: job, error: jobErr } = await supabase
      .from('catering_jobs')
      .select('*')
      .eq('id', job_id)
      .single();
    if (jobErr || !job) return jsonResponse({ error: 'Catering job not found.' }, 404);

    const { data: org } = await supabase
      .from('organisations')
      .select('staff_hub_public_token')
      .eq('id', job.org_id)
      .single();

    const viewUrl = org?.staff_hub_public_token
      ? `${APP_URL}/cater/${org.staff_hub_public_token}?d=${job.job_date}`
      : APP_URL;

    const html = buildEmailHtml(job, viewUrl);
    const subject = `[W${isoWeek(job.job_date)}-${dayAbbrev(job.job_date)}] New Catering Job - ${job.company || 'Untitled job'} ${ddmm(job.job_date)}`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'R-Cater <catering-alert@itsrecess.com.au>',
        // test_to lets a single address be used for a one-off test send
        // instead of fanning out to the whole distribution list.
        to: typeof test_to === 'string' && test_to ? [test_to] : RECIPIENTS,
        subject,
        html,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', JSON.stringify(data));
      return jsonResponse({ error: data.message || data.name || 'Resend rejected the request' });
    }

    return jsonResponse({ success: true, id: data.id });
  } catch (err) {
    console.error('send-catering-job-alert error:', err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
