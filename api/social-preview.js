// Serves the same SPA shell as index.html for the public read-only routes,
// but with route-specific <title>/description/OG tags swapped in server-side.
//
// Why this exists: link-preview bots (Slack, iMessage, WhatsApp, etc.) only
// ever read the raw HTML response -- they don't execute the client bundle --
// so every public link (roster, production plan, transfer hub, staff hub)
// was unfurling as "Recess Roster" regardless of which page it pointed to.
// This fetches the deployment's own built index.html at request time (so it
// always has the current hashed JS/CSS bundle references, without this file
// needing to know them) and only rewrites the <head> metadata.
//
// vercel.json routes each public path prefix here before falling through to
// the normal /index.html catch-all, so real visitors still get the fully
// working app -- only the <title>/meta tags differ per route.

const ROUTE_META = [
  { prefix: '/hub/', title: 'R-Shift', description: 'Staff links for production and transfers.' },
  { prefix: '/prod/', title: 'R-Prod', description: 'Read-only production plan — no login required.' },
  { prefix: '/transfers/', title: 'Transfer Hub', description: "See what's needed at either site before you head over." },
  { prefix: '/r/', title: 'R-Shift Roster', description: 'Read-only staff roster — no login required.' },
  { prefix: '/s/', title: 'My Shifts', description: 'Your upcoming shifts — no login required.' },
];

function metaFor(pathname) {
  const match = ROUTE_META.find(r => pathname.startsWith(r.prefix));
  return match || { title: 'Recess Roster', description: 'Staff scheduling and roster management' };
}

module.exports = async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];
  const { title, description } = metaFor(pathname);

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;

  let html;
  try {
    const upstream = await fetch(`${proto}://${host}/index.html`);
    html = await upstream.text();
  } catch (err) {
    res.statusCode = 502;
    res.end('Failed to load app shell');
    return;
  }

  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/?>/s, `<meta name="description" content="${description}" />`);

  if (!html.includes('property="og:title"')) {
    html = html.replace(
      '</head>',
      `  <meta property="og:title" content="${title}" />\n` +
      `  <meta property="og:description" content="${description}" />\n` +
      `  <meta property="og:type" content="website" />\n` +
      `  <meta name="twitter:card" content="summary" />\n` +
      `  <meta name="twitter:title" content="${title}" />\n` +
      `  <meta name="twitter:description" content="${description}" />\n` +
      `</head>`
    );
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.statusCode = 200;
  res.end(html);
};
