import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

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
  shifts: ShiftRow[];
  totalHours: string;
  businessName: string;
  fromAddress: string; // e.g. "roster@recesstech.com.au"
}

function buildHtml(p: Payload): string {
  const lastIdx = p.shifts.length - 1;
  const rows = p.shifts.map((s, i) => {
    const borderBottom = i < lastIdx ? 'border-bottom:1px solid #F1F5F9;' : '';
    if (s.isOff) {
      return `<tr style="background:#FAFAFA">
        <td style="padding:11px 16px;${borderBottom}width:110px;font-size:13px;font-weight:600;color:#94A3B8">${s.date}</td>
        <td style="padding:11px 16px;${borderBottom}font-size:13px;color:#94A3B8;font-style:italic">Off</td>
        <td style="padding:11px 16px;${borderBottom}text-align:right;font-size:13px;color:#CBD5E1;width:60px">–</td>
      </tr>`;
    }
    return `<tr>
      <td style="padding:11px 16px;${borderBottom}width:110px;font-size:13px;font-weight:600;color:#1E293B">${s.date}</td>
      <td style="padding:11px 16px;${borderBottom}font-size:13px;color:#334155;font-family:'Courier New',Courier,monospace;letter-spacing:0.01em">${s.time}</td>
      <td style="padding:11px 16px;${borderBottom}text-align:right;font-size:13px;font-weight:700;color:#3B5BDB;width:60px">${s.hours}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Your roster – ${p.weekRange}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">

        <!-- Header -->
        <tr>
          <td style="background:#3B5BDB;padding:24px 28px;border-radius:10px 10px 0 0">
            <div style="color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Your roster</div>
            <div style="color:#ffffff;font-size:24px;font-weight:700;line-height:1.2;margin-bottom:4px">${p.staffName}</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px">${p.weekRange}</div>
          </td>
        </tr>

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
          <td style="background:#EEF2FF;border:1px solid #C7D2FE;border-top:none;border-radius:0 0 10px 10px;padding:0">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:13px 16px;font-size:13px;font-weight:600;color:#3730A3">Total hours</td>
                <td style="padding:13px 16px;text-align:right;font-size:20px;font-weight:700;color:#3B5BDB">${p.totalHours}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 0 8px;text-align:center;font-size:11px;color:#94A3B8">
            Sent by ${p.businessName} via Recess Roster
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
        from: payload.fromAddress || 'Recess Roster <onboarding@resend.dev>',
        to: [payload.to],
        subject: `Your roster – ${payload.weekRange}`,
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
