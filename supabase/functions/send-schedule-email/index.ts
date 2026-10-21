import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Brand tokens -- R-Shift's own blue colourway, shared across every
// R-Shift email (order-status, catering job alerts, this one) so they all
// read as one product rather than each screen inventing its own look.
const BRAND = '#3B5BDB';
const BRAND_DARK = '#2D4EC9';
const LOGO_URL = 'https://i.postimg.cc/76YSLjdw/rshift-on-cream.jpg';

// Allow calls from the browser (same Supabase project)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShiftRow {
  date: string;        // e.g. "Mon 7 Apr"
  time: string;        // e.g. "07:00 – 15:00"
  hours: string;       // e.g. "8.0h"
  isOff: boolean;
}

interface Payload {
  to: string;
  staffName: string;
  weekRange: string;
  weekLabel: string; // e.g. "W40" -- used for the subject line
  shifts: ShiftRow[];
  totalHours: string;
  ccHello?: boolean;    // CC the shared Recess inbox
  personalNote?: string | null; // note for this recipient only
  note?: string | null; // optional message from the manager, shown above the roster
  businessName: string;
  fromAddress: string; // e.g. "R-Shift <roster@itsrecess.com.au>"
}

// Fixed server-side so the endpoint can't be used to CC arbitrary addresses
const CC_HELLO = 'hello@itsrecess.com.au';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHtml(p: Payload): string {
  const noteBox = (raw: string | null | undefined, label: string, bg: string, border: string, labelColor: string, textColor: string) => {
    const text = (raw || '').trim().slice(0, 500);
    if (!text) return '';
    return `
        <tr>
          <td style="background:#ffffff;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;padding:0">
            <div style="margin:16px 16px 0;padding:14px 16px;background:${bg};border-left:4px solid ${border};border-radius:6px">
              <div style="font-size:10px;font-weight:700;color:${labelColor};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">${label}</div>
              <div style="font-size:14px;line-height:1.5;color:${textColor}">${esc(text).replace(/\r?\n/g, '<br>')}</div>
            </div>
          </td>
        </tr>`;
  };
  // Personal note first (most relevant to the reader), then the note to everyone
  const noteHtml =
    noteBox(p.personalNote, `A note for you, ${esc(p.staffName)}`, '#FEF3C7', '#F59E0B', '#92400E', '#451A03') +
    noteBox(p.note, `A note from ${esc(p.businessName)}`, '#EEF2FF', '#3B5BDB', '#3730A3', '#1E1B4B');
  const lastIdx = p.shifts.length - 1;
  const rows = p.shifts.map((s, i) => {
    const borderBottom = i < lastIdx ? 'border-bottom:1px solid #F1F5F9;' : '';
    if (s.isOff) {
      return `<tr style="background:#FAFAFA">
        <td style="padding:11px 16px;${borderBottom}width:110px;font-size:13px;font-weight:600;color:#94A3B8">${esc(s.date)}</td>
        <td style="padding:11px 16px;${borderBottom}font-size:13px;color:#94A3B8;font-style:italic">Off</td>
        <td style="padding:11px 16px;${borderBottom}text-align:right;font-size:13px;color:#CBD5E1;width:60px">–</td>
      </tr>`;
    }
    return `<tr>
      <td style="padding:11px 16px;${borderBottom}width:110px;font-size:13px;font-weight:600;color:#1E293B">${esc(s.date)}</td>
      <td style="padding:11px 16px;${borderBottom}font-size:13px;color:#334155;font-family:'Courier New',Courier,monospace;letter-spacing:0.01em">${esc(s.time)}</td>
      <td style="padding:11px 16px;${borderBottom}text-align:right;font-size:13px;font-weight:700;color:#3B5BDB;width:60px">${esc(s.hours)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(p.weekLabel ? `Roster ${p.weekLabel}` : `Your roster – ${p.weekRange}`)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:28px 16px">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%">

        <!-- Brand header -->
        <tr>
          <td style="background:${BRAND};background:linear-gradient(160deg,${BRAND},${BRAND_DARK});border-radius:14px 14px 0 0;padding:22px 28px">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="width:40px;vertical-align:middle">
                <table cellpadding="0" cellspacing="0" width="36" height="36" style="border-radius:10px;overflow:hidden">
                  <tr><td style="width:36px;height:36px"><img src="${LOGO_URL}" alt="R-Shift" width="36" height="36" style="display:block;width:36px;height:36px;object-fit:cover;border-radius:10px"></td></tr>
                </table>
              </td>
              <td style="vertical-align:middle;padding-left:4px">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75)">R-Shift &middot; Your Roster</div>
                <div style="font-size:21px;font-weight:800;color:#ffffff;margin-top:1px">${esc(p.staffName)}</div>
              </td>
            </tr></table>
            <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:10px">${esc(p.weekRange)}</div>
          </td>
        </tr>

${noteHtml}
        <!-- Schedule table -->
        <tr>
          <td style="background:#ffffff;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;padding:0">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <thead>
                <tr style="background:#F8FAFC">
                  <th style="padding:9px 16px;text-align:left;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #E2E8F0;width:110px">Day</th>
                  <th style="padding:9px 16px;text-align:left;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #E2E8F0">Time</th>
                  <th style="padding:9px 16px;text-align:right;font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #E2E8F0;width:60px">Hrs</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Total footer -->
        <tr>
          <td style="background:#EEF2FF;border:1px solid #C7D2FE;border-top:none;border-radius:0 0 14px 14px;padding:0">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:13px 16px;font-size:13px;font-weight:600;color:#3730A3">Total hours</td>
                <td style="padding:13px 16px;text-align:right;font-size:20px;font-weight:700;color:#3B5BDB">${esc(p.totalHours)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 4px 0;text-align:center">
            <div style="font-size:11px;color:#94A3B8;margin-bottom:6px">Sent by ${esc(p.businessName)}</div>
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: Payload = await req.json();

    if (!payload.to || !payload.staffName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml(payload);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.fromAddress || 'R-Shift <roster@itsrecess.com.au>',
        to: [payload.to],
        ...(payload.ccHello && payload.to.toLowerCase() !== CC_HELLO ? { cc: [CC_HELLO] } : {}),
        subject: payload.weekLabel ? `Roster ${payload.weekLabel}` : `Your roster – ${payload.weekRange}`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', JSON.stringify(data));
      return new Response(JSON.stringify({ error: data.message || data.name || 'Resend rejected the request', detail: data }), {
        status: 200, // return 200 so the client can read the body
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
