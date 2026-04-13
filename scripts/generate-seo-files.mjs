#!/usr/bin/env node
/**
 * generate-seo-files.mjs
 * Генерирует robots.txt, sitemap*.xml под ЛЮБОЙ домен автоматически.
 *
 * Домен берётся из env (в порядке приоритета):
 *   SITE_ORIGIN         → https://mynewdomain.ru
 *   URL                 → Netlify production
 *   DEPLOY_PRIME_URL    → Netlify preview
 *   VERCEL_URL          → Vercel (добавляет https://)
 *   RENDER_EXTERNAL_URL → Render
 *   fallback            → https://smotrim.net
 */
import { writeFileSync } from 'node:fs';

const FALLBACK        = 'https://smotrim.net';
const STREAM_API      = 'https://aqeleulwobgamdffkfri.supabase.co/functions/v1/public-channels';
const IPTV_API        = 'https://iptv-org.github.io/api/channels.json';
const ALLOWED_OWNERS  = ['oinktech', 'Twixoff', 'ТВКАНАЛЫ'];

function norm(v) {
  if (!v) return null;
  const s = v.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

const origin = norm(process.env.SITE_ORIGIN)
  || norm(process.env.URL)
  || norm(process.env.DEPLOY_PRIME_URL)
  || norm(process.env.VERCEL_URL)
  || norm(process.env.RENDER_EXTERNAL_URL)
  || FALLBACK;

const today = new Date().toISOString().slice(0, 10);
console.log('\n🌍 SEO build for:', origin, '\n');

/* robots.txt */
writeFileSync('robots.txt', [
  `# Auto-generated for ${origin}`,
  'User-agent: *', 'Allow: /',
  'Disallow: /api/', 'Disallow: /admin/', 'Disallow: /*.json$', '',
  'User-agent: Yandex', 'Allow: /', 'Crawl-delay: 1',
  'Disallow: /api/', 'Disallow: /admin/', '',
  'User-agent: Googlebot', 'Allow: /', 'Crawl-delay: 0', '',
  'User-agent: Bingbot',  'Allow: /', 'Crawl-delay: 1', '',
  `Sitemap: ${origin}/sitemap.xml`,
].join('\n') + '\n');

/* sitemap index */
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${origin}/sitemap-main.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${origin}/sitemap-channels.xml</loc><lastmod>${today}</lastmod></sitemap>
  <sitemap><loc>${origin}/sitemap-iptv.xml</loc><lastmod>${today}</lastmod></sitemap>
</sitemapindex>\n`);

/* sitemap-main */
const pages = [
  ['/',             '1.0', 'daily'],
  ['/tv',           '0.9', 'daily'],
  ['/radio',        '0.9', 'daily'],
  ['/iptv',         '0.9', 'daily'],
  ['/embed.html',   '0.7', 'weekly'],
  ['/about.html',   '0.5', 'monthly'],
  ['/contacts.html','0.4', 'monthly'],
  ['/terms.html',   '0.3', 'monthly'],
  ['/privacy.html', '0.3', 'monthly'],
];
writeFileSync('sitemap-main.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([p, pr, cf]) =>
`  <url><loc>${origin}${p}</loc><lastmod>${today}</lastmod><changefreq>${cf}</changefreq><priority>${pr}</priority></url>`
).join('\n')}
</urlset>\n`);
console.log('✅ robots.txt  sitemap.xml  sitemap-main.xml');

/* helpers */
function slugify(s = '') {
  return s.toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, c => ({'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'}[c] || c))
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* sitemap-channels */
async function channelsSitemap() {
  let all = [], page = 1;
  try {
    while (page <= 20) {
      const r = await fetch(`${STREAM_API}?page=${page}&limit=100`);
      const j = await r.json();
      all = all.concat(j.data || []);
      if (page >= (j.pagination?.total_pages || 1)) break;
      page++;
    }
  } catch (e) { console.warn('⚠️  channels fetch:', e.message); }

  const filtered = all.filter(ch =>
    ALLOWED_OWNERS.some(o => o.toLowerCase() === (ch.owner?.username || '').toLowerCase())
  );
  writeFileSync('sitemap-channels.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${filtered.map(ch => `  <url><loc>${origin}/watch/${encodeURIComponent(slugify(ch.title||ch.id||'channel'))}</loc><lastmod>${(ch.updated_at||'').slice(0,10)||today}</lastmod><changefreq>always</changefreq><priority>0.8</priority></url>`).join('\n')}
</urlset>\n`);
  console.log(`✅ sitemap-channels.xml — ${filtered.length} channels`);
  return filtered.length;
}

/* sitemap-iptv */
async function iptvSitemap() {
  let list = [];
  try {
    const r = await fetch(IPTV_API);
    list = (await r.json() || []).slice(0, 5000);
  } catch (e) { console.warn('⚠️  iptv fetch:', e.message); }
  writeFileSync('sitemap-iptv.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${list.map(ch => `  <url><loc>${origin}/iptv/${encodeURIComponent(slugify(ch.name||ch.id||'iptv'))}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`).join('\n')}
</urlset>\n`);
  console.log(`✅ sitemap-iptv.xml — ${list.length} channels`);
  return list.length;
}

const [s, i] = await Promise.all([channelsSitemap(), iptvSitemap()]);
console.log(`\n🎉 Done  origin=${origin}  streams=${s}  iptv=${i}`);
