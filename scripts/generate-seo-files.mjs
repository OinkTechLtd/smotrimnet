#!/usr/bin/env node
/**
 * generate-seo-files.mjs
 * Автоматически генерирует robots.txt, sitemap.xml, sitemap-main.xml,
 * sitemap-channels.xml, sitemap-iptv.xml под ЛЮБОЙ домен.
 *
 * Источник домена (в порядке приоритета):
 *   1. SITE_ORIGIN  — произвольный env var (https://mynewdomain.ru)
 *   2. URL          — Netlify
 *   3. DEPLOY_PRIME_URL — Netlify preview
 *   4. VERCEL_URL   — Vercel (только хост, без протокола)
 *   5. RENDER_EXTERNAL_URL — Render
 *   6. fallback: https://smotrim.net
 */
import { writeFileSync } from 'node:fs';

const FALLBACK_ORIGIN   = 'https://smotrim.net';
const STREAM_API        = 'https://aqeleulwobgamdffkfri.supabase.co/functions/v1/public-channels';
const IPTV_CHANNELS_API = 'https://iptv-org.github.io/api/channels.json';
const ALLOWED_OWNERS    = ['oinktech', 'Twixoff', 'ТВКАНАЛЫ'];

function normalizeOrigin(value) {
  if (!value) return null;
  const s = value.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

const origin = (
  normalizeOrigin(process.env.SITE_ORIGIN) ||
  normalizeOrigin(process.env.URL) ||
  normalizeOrigin(process.env.DEPLOY_PRIME_URL) ||
  normalizeOrigin(process.env.VERCEL_URL) ||
  normalizeOrigin(process.env.RENDER_EXTERNAL_URL) ||
  FALLBACK_ORIGIN
);

const today = new Date().toISOString().slice(0, 10);

console.log(`\n🌍 Generating SEO files for: ${origin}\n`);

// ─── robots.txt ───────────────────────────────────────────
const robotsTxt = `# robots.txt — auto-generated for ${origin}
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /*.json$

# Yandex
User-agent: Yandex
Allow: /
Crawl-delay: 1
Disallow: /api/
Disallow: /admin/

# Google
User-agent: Googlebot
Allow: /
Crawl-delay: 0

# Bing
User-agent: Bingbot
Allow: /
Crawl-delay: 1

Sitemap: ${origin}/sitemap.xml
`;

// ─── sitemap index ────────────────────────────────────────
const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${origin}/sitemap-main.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${origin}/sitemap-channels.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${origin}/sitemap-iptv.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>
`;

// ─── sitemap-main ─────────────────────────────────────────
const staticPages = [
  { path: '/',             priority: '1.0', changefreq: 'daily'   },
  { path: '/tv',           priority: '0.9', changefreq: 'daily'   },
  { path: '/radio',        priority: '0.9', changefreq: 'daily'   },
  { path: '/iptv',         priority: '0.9', changefreq: 'daily'   },
  { path: '/embed.html',   priority: '0.7', changefreq: 'weekly'  },
  { path: '/about.html',   priority: '0.5', changefreq: 'monthly' },
  { path: '/contacts.html',priority: '0.4', changefreq: 'monthly' },
  { path: '/terms.html',   priority: '0.3', changefreq: 'monthly' },
  { path: '/privacy.html', priority: '0.3', changefreq: 'monthly' },
];

const sitemapMainXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(({ path, priority, changefreq }) => `  <url>
    <loc>${origin}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync('robots.txt',       robotsTxt);
writeFileSync('sitemap.xml',      sitemapIndexXml);
writeFileSync('sitemap-main.xml', sitemapMainXml);
console.log('✅ robots.txt, sitemap.xml, sitemap-main.xml written');

// ─── helpers ──────────────────────────────────────────────
function slugify(str = '') {
  return str.toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, ch => ({
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
      'ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
      'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
      'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
      'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    }[ch] || ch))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── sitemap-channels (StreamLiveTV) ──────────────────────
async function buildChannelsSitemap() {
  let channels = [];
  let page = 1;
  try {
    while (page <= 20) {
      const res  = await fetch(`${STREAM_API}?page=${page}&limit=100`);
      const json = await res.json();
      channels = channels.concat(json.data || []);
      if (page >= (json.pagination?.total_pages || 1)) break;
      page++;
    }
  } catch (err) {
    console.warn('⚠️  Channel sitemap fallback (network error):', err.message);
  }

  const filtered = channels.filter(ch =>
    ALLOWED_OWNERS.some(o => o.toLowerCase() === (ch.owner?.username || '').toLowerCase())
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${filtered.map(ch => `  <url>
    <loc>${origin}/watch/${encodeURIComponent(slugify(ch.title || ch.id || 'channel'))}</loc>
    <lastmod>${(ch.updated_at || '').slice(0, 10) || today}</lastmod>
    <changefreq>always</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>
`;
  writeFileSync('sitemap-channels.xml', xml);
  console.log(`✅ sitemap-channels.xml — ${filtered.length} channels`);
  return filtered.length;
}

// ─── sitemap-iptv (iptv-org) ──────────────────────────────
async function buildIptvSitemap() {
  let list = [];
  try {
    const res  = await fetch(IPTV_CHANNELS_API);
    const data = await res.json();
    list = (data || []).slice(0, 5000);
  } catch (err) {
    console.warn('⚠️  IPTV sitemap fallback (network error):', err.message);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${list.map(ch => `  <url>
    <loc>${origin}/iptv/${encodeURIComponent(slugify(ch.name || ch.id || 'iptv'))}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>
`;
  writeFileSync('sitemap-iptv.xml', xml);
  console.log(`✅ sitemap-iptv.xml — ${list.length} channels`);
  return list.length;
}

// ─── run ─────────────────────────────────────────────────
const [streamCount, iptvCount] = await Promise.all([
  buildChannelsSitemap(),
  buildIptvSitemap(),
]);

console.log(`\n🎉 Done! origin=${origin}, streams=${streamCount}, iptv=${iptvCount}`);
