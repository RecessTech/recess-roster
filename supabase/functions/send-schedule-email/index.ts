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
  const rows = p.shifts.map(s => s.isOff
    ? `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #F1F5F9">
          <span style="font-weight:600;color:#1E293B;font-size:13px">${s.date}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #F1F5F9;color:#94A3B8;font-style:italic;font-size:13px">Off</td>
        <td style="padding:10px 16px;border-bottom:1px solid #F1F5F9;text-align:right;color:#94A3B8;font-size:13px">–</td>
      </tr>`
    : `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #F1F5F9">
          <span style="font-weight:600;color:#1E293B;font-size:13px">${s.date}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#1E293B;font-family:monospace">${s.time}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #F1F5F9;text-align:right;font-weight:600;color:#1E293B;font-size:13px">${s.hours}</td>
      </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto">

    <div style="background:#3B5BDB;padding:20px 24px;border-radius:10px 10px 0 0">
      <div style="color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:0.06em">Your roster</div>
      <div style="color:white;font-size:22px;font-weight:700;margin-top:3px">${p.staffName}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:2px">${p.weekRange}</div>
    </div>

    <div style="background:white;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F8FAFC">
            <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E2E8F0">Day</th>
            <th style="padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E2E8F0">Time</th>
            <th style="padding:8px 16px;text-align:right;font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E2E8F0">Hours</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:12px 16px;background:#EEF2FF;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600;color:#1E293B">Total hours</span>
        <span style="font-size:18px;font-weight:700;color:#3B5BDB">${p.totalHours}</span>
      </div>
    </div>

    <p style="text-align:center;color:#94A3B8;font-size:11px;margin-top:16px">
      Sent by ${p.businessName} via Recess Roster
    </p>
  </div>
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
        from: payload.fromAddress || 'roster@recesstech.com.au',
        to: [payload.to],
        subject: `Your roster – ${payload.weekRange}`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data.message || 'Send failed' }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
