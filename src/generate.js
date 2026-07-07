/**
 * TranslaStars Industry News Generator
 * Daily newspaper-style page for localization industry news.
 * Usage: node src/generate.js  →  outputs docs/index.html
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'docs');
const DROPBOX_DIR = path.join('C:\\Users\\barto\\Dropbox', 'OpenClaw Proyectos', 'Industry News');
const SITE_URL = 'https://translastars.github.io/industry-news/';

// ── HTTP fetch with redirect following ──
async function fetch(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    let cancelled = false;
    const req = mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume(); // drain response
        return fetch(loc).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} ${url.replace(/https?:\/\//, '').substring(0, 60)}`));
      }
      const chunks = [];
      res.on('data', c => { if (!cancelled) chunks.push(c); });
      res.on('end', () => { if (!cancelled) resolve(Buffer.concat(chunks).toString()); });
    });
    req.on('error', reject);
    req.on('timeout', () => { cancelled = true; req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── RSS parser ──
function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag) => {
      const x = b.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
      return x ? x[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
    };
    const title = g('title');
    const link = g('link') || g('guid');
    const date = g('pubDate');
    const desc = g('description').replace(/<[^>]*>/g, '').substring(0, 350);
    const img = (b.match(/<media:content[^>]*url="([^"]+)"/i) ||
                 b.match(/<enclosure[^>]*url="([^"]+)"/i) ||
                 b.match(/<media:thumbnail[^>]*url="([^"]+)"/i) || [])[1] || '';
    if (title && link && title.length > 5) {
      items.push({
        title: title.replace(/&#[0-9]+;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ''),
        link, date: date ? new Date(date).toISOString() : '',
        excerpt: desc, image: img
      });
    }
  }
  return items;
}

// ── Helpers ──
function stripHTML(s) {
  return s ? s.replace(/<[^>]*>/g, '').replace(/&#[0-9]+;/g, ' ').replace(/&amp;/g, '&').trim() : '';
}
function truncate(s, max) {
  const c = stripHTML(s); return c.length > max ? c.substring(0, max) + '…' : c;
}
function relativeDate(d) {
  const now = new Date(), date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const days = Math.floor((now - date) / 86400000);
  if (days < 0) return 'Today';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDate(d) { return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function getIssueNum() { return Math.floor((new Date() - new Date('2026-01-01')) / 86400000) + 1; }

function safeImg(url) {
  if (!url) return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22400%22%3E%3Crect fill=%22%23522D6D%22 width=%22600%22 height=%22400%22/%3E%3Ctext fill=%22white%22 font-family=%22Arial%22 font-size=%2224%22 x=%2240%22 y=%22200%22%3ETranslaStars%20News%3C/text%3E%3C/svg%3E';
  return url;
}

// ── Sources ──
const SOURCES = [
  { name: 'Slator',        url: 'https://slator.com/feed/',                                                  color: '#1a73e8', section: 'Industry' },
  { name: 'Nimdzi',        url: 'https://www.nimdzi.com/feed/',                                              color: '#e63946', section: 'Industry' },
  { name: 'TechCrunch',    url: 'https://techcrunch.com/feed/',                                              color: '#0a9e01', section: 'Industry' },
  { name: 'CNBC Tech',     url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', color: '#005da3', section: 'Industry' },
  { name: 'The Guardian',  url: 'https://www.theguardian.com/technology/rss',                                 color: '#052962', section: 'World News' },
  { name: 'BBC Technology',url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',                           color: '#bb1919', section: 'World News' },
  { name: 'Wired',         url: 'https://www.wired.com/feed/rss',                                            color: '#000',   section: 'World News' },
  { name: 'EU Commission', url: 'https://ec.europa.eu/commission/presscorner/api/rss?type=IP&language=en',    color: '#003399', section: 'Policy' },
];

async function fetchSource(name, url, color, section) {
  try {
    const xml = await fetch(url);
    const items = parseRSS(xml);
    if (items.length === 0) { console.log(`  ~ ${name}: 0 items`); return []; }
    return items.map(item => ({
      title: item.title.replace(/&#[0-9]+;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ''),
      link: item.link,
      date: item.date,
      excerpt: stripHTML(item.excerpt),
      image: item.image,
      source: name,
      sourceColor: color,
      section,
      relativeDate: relativeDate(item.date),
    }));
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message.substring(0, 60)}`);
    return [];
  }
}

// ── Main ──
async function generate() {
  console.log('📰 TranslaStars Industry News — Daily Edition\n');

  const allArticles = [];

  // Fetch each source sequentially to avoid connection contention
  for (const src of SOURCES) {
    const articles = await fetchSource(src.name, src.url, src.color, src.section);
    if (articles.length > 0) {
      console.log(`  ✓ ${src.name}: ${articles.length} articles`);
      allArticles.push(...articles);
    }
  }

  // Sort newest first
  allArticles.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date);
    if (isNaN(da.getTime()) && isNaN(db.getTime())) return 0;
    if (isNaN(da.getTime())) return 1;
    if (isNaN(db.getTime())) return -1;
    return db - da;
  });

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const a of allArticles) {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);
    if (!seen.has(key)) { seen.add(key); unique.push(a); }
  }

  const issueNum = getIssueNum();
  const today = new Date();
  const topStory = unique[0] || null;
  const sections = ['Industry', 'World News', 'Policy'];
  const sectioned = {};
  for (const s of sections) sectioned[s] = unique.filter(a => a.section === s);

  // ── HTML ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TranslaStars Industry News — Daily Edition</title>
<meta name="description" content="Daily curated news for language and localization professionals.">
<meta property="og:title" content="TranslaStars Industry News">
<meta property="og:description" content="Daily curated news for localization & AI professionals.">
<meta property="og:url" content="${SITE_URL}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📰%3C/text%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&amp;family=Inter:wght@300;400;500;600;700;800&amp;family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}html{font-size:16px}
body{font-family:'Inter',-apple-system,sans-serif;background:#f4f2ed;color:#111;line-height:1.6;-webkit-font-smoothing:antialiased}
.masthead{background:#fff;border-bottom:3px solid #522D6D;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
.masthead-inner{max-width:1200px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}
.masthead .logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:#522D6D;text-decoration:none;letter-spacing:-.5px}
.masthead .logo span{color:#FF6B00}
.masthead .nav{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.masthead .nav a{font-size:11px;font-weight:600;color:#666;text-decoration:none;text-transform:uppercase;letter-spacing:1px;transition:color .2s}
.masthead .nav a:hover{color:#522D6D}
.masthead .issue-badge{background:#522D6D;color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px}
@media(max-width:640px){.masthead-inner{flex-direction:column;gap:8px;padding:10px 16px}.masthead .nav{gap:10px;justify-content:center}}
.hero{background:linear-gradient(135deg,#522D6D 0%,#7B3FAF 50%,#FF6B00 100%);color:#fff;padding:48px 24px 36px;text-align:center;position:relative}
.hero h1{font-family:'Playfair Display',serif;font-size:48px;font-weight:900;letter-spacing:-1.5px;margin-bottom:8px;line-height:1.1}
.hero .tagline{font-size:16px;opacity:.85;font-weight:300;max-width:560px;margin:0 auto}
.hero .meta{display:flex;justify-content:center;gap:28px;margin-top:20px;font-size:13px;opacity:.7;border-top:1px solid rgba(255,255,255,0.15);padding-top:16px;flex-wrap:wrap}
@media(max-width:640px){.hero h1{font-size:30px}.hero{padding:32px 16px 24px}.hero .meta{gap:12px;font-size:12px}}
.container{max-width:1200px;margin:0 auto;padding:32px 24px}
@media(max-width:640px){.container{padding:20px 16px}}
.source-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px;padding:12px 18px;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.04);align-items:center}
.source-bar .label{font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-right:8px}
.source-bar .src-pill{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:500;color:#555;padding:2px 8px;border-radius:4px;background:#f5f5f5}
.source-bar .src-pill .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.source-bar .count{font-size:11px;color:#999;margin-left:auto}
.featured{display:grid;grid-template-columns:1.2fr 1fr;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.06);margin-bottom:32px;min-height:400px}
.featured .feat-img{background-size:cover;background-position:center;min-height:400px;position:relative}
.featured .feat-img .overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,rgba(82,45,109,0.35),transparent 60%)}
.featured .feat-body{padding:40px;display:flex;flex-direction:column;justify-content:center}
.featured .feat-source{display:inline-block;background:#f0ecf5;color:#522D6D;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;border-radius:4px;margin-bottom:14px;align-self:flex-start}
.featured h2{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;line-height:1.3;margin-bottom:14px;color:#111}
.featured .feat-excerpt{font-size:15px;color:#555;line-height:1.7;margin-bottom:16px}
.featured .feat-meta{font-size:12px;color:#999;margin-bottom:18px}
.featured .feat-cta{display:inline-flex;align-items:center;gap:8px;background:#522D6D;color:#fff;text-decoration:none;padding:11px 26px;border-radius:8px;font-weight:600;font-size:14px;transition:all .2s;align-self:flex-start}
.featured .feat-cta:hover{background:#7B3FAF;transform:translateY(-1px);box-shadow:0 4px 12px rgba(82,45,109,0.3)}
@media(max-width:768px){
  .featured{grid-template-columns:1fr}
  .featured .feat-img{min-height:200px}
  .featured .feat-img .overlay{background:linear-gradient(0deg,rgba(82,45,109,0.3),transparent 50%)}
  .featured .feat-body{padding:24px}
  .featured h2{font-size:22px}
}
.section-head{display:flex;align-items:center;margin-bottom:20px;padding-bottom:10px;border-bottom:3px solid #522D6D}
.section-head h3{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#522D6D}
.section-head .scount{font-size:12px;color:#999;margin-left:10px;font-weight:400;font-family:'Inter',sans-serif}
.news-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-bottom:36px}
@media(max-width:640px){.news-grid{grid-template-columns:1fr}}
.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.05);transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column}
.card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(0,0,0,.1)}
.card .card-img{height:170px;background-size:cover;background-position:center;background-color:#f0ecf5;position:relative}
.card .card-img .card-tag{position:absolute;top:10px;left:10px;background:rgba(82,45,109,0.85);color:#fff;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:4px}
.card .card-body{padding:18px;flex:1;display:flex;flex-direction:column}
.card .card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.card .card-source{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#522D6D}
.card .card-date{font-size:11px;color:#999}
.card h4{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;line-height:1.35;margin-bottom:8px;color:#111}
.card .card-text{font-size:13px;color:#666;line-height:1.6;flex:1;margin-bottom:10px}
.card .card-link{color:#522D6D;text-decoration:none;font-weight:600;font-size:12px;transition:color .2s}
.card .card-link:hover{color:#7B3FAF;text-decoration:underline}
.empty-state{background:#fff;border-radius:12px;padding:48px;text-align:center;color:#999;grid-column:1/-1}
.footer{background:#1a1a2e;color:#999;padding:36px 24px;text-align:center;margin-top:20px}
.footer .inner{max-width:600px;margin:0 auto}
.footer a{color:#7B3FAF;text-decoration:none}
.footer a:hover{text-decoration:underline}
.footer p{font-size:12px;line-height:1.8}
.footer .powered{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.1);font-size:11px;opacity:.6}
</style>
</head>
<body>
<header class="masthead">
  <div class="masthead-inner">
    <a href="${SITE_URL}" class="logo">TranslaStars <span>News</span></a>
    <nav class="nav">
      <a href="#Industry">Industry</a>
      <a href="#World-News">World</a>
      <a href="#Policy">Policy</a>
      <span class="issue-badge">#${issueNum}</span>
    </nav>
  </div>
</header>
<section class="hero">
  <h1>Industry News</h1>
  <p class="tagline">Curated daily for language, localization &amp; AI professionals — by TranslaStars</p>
  <div class="meta">
    <span>${fmtDate(today)}</span>
    <span>${unique.length} articles</span>
    <span>${SOURCES.length} sources</span>
  </div>
</section>
<div class="container">
<div class="source-bar">
  <span class="label">Sources</span>
  ${SOURCES.map(s => `<span class="src-pill"><span class="dot" style="background:${s.color}"></span>${s.name}</span>`).join('\n  ')}
  <span class="count">Updated daily</span>
</div>

${topStory ? `
<article class="featured">
  <div class="feat-img" style="background-image:url('${safeImg(topStory.image)}')"><div class="overlay"></div></div>
  <div class="feat-body">
    <span class="feat-source" style="color:${topStory.sourceColor}">${topStory.source}</span>
    <h2>${topStory.title}</h2>
    <p class="feat-excerpt">${truncate(topStory.excerpt, 220)}</p>
    <div class="feat-meta">${topStory.relativeDate}</div>
    <a href="${topStory.link}" target="_blank" rel="noopener" class="feat-cta">Read full article →</a>
  </div>
</article>` : ''}

${sections.map(section => {
  const secArticles = sectioned[section] || [];
  if (secArticles.length === 0) return '';
  const display = secArticles.slice(0, 6);
  return `
<section id="${section.replace(/\s+/g,'-')}">
  <div class="section-head">
    <h3>${section}</h3>
    <span class="scount">(${secArticles.length} articles)</span>
  </div>
  <div class="news-grid">
    ${display.map(a => `
    <article class="card">
      <div class="card-img" style="background-image:url('${safeImg(a.image)}')">
        <span class="card-tag">${a.source}</span>
      </div>
      <div class="card-body">
        <div class="card-top">
          <span class="card-source">${a.source}</span>
          <span class="card-date">${a.relativeDate}</span>
        </div>
        <h4>${a.title}</h4>
        <p class="card-text">${truncate(a.excerpt, 120)}</p>
        <a href="${a.link}" target="_blank" rel="noopener" class="card-link">Read more →</a>
      </div>
    </article>`).join('\n    ')}
  </div>
</section>`}).filter(Boolean).join('\n\n')}

</div>
<footer class="footer">
  <div class="inner">
    <p><strong style="color:#fff">TranslaStars Industry News</strong> — Daily curated news for localization professionals</p>
    <p style="margin-top:6px"><a href="https://www.translastars.com" target="_blank">TranslaStars</a> · <a href="https://github.com/translastars/industry-news" target="_blank">GitHub</a> · <a href="${SITE_URL}">Home</a></p>
    <p style="margin-top:6px;font-size:12px">News automatically curated from public sources. All links open in new windows.</p>
    <div class="powered">Generated ${today.toISOString().substring(0,19).replace('T',' ')} · Issue #${issueNum} · Powered by TranslaStars AI ✦</div>
  </div>
</footer>
</body>
</html>`;

  // Write
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html, 'utf8');
  console.log(`\n✅ docs/index.html (${Buffer.byteLength(html, 'utf8').toLocaleString()} bytes)`);

  if (fs.existsSync('C:\\Users\\barto\\Dropbox')) {
    if (!fs.existsSync(DROPBOX_DIR)) fs.mkdirSync(DROPBOX_DIR, { recursive: true });
    fs.writeFileSync(path.join(DROPBOX_DIR, 'index.html'), html, 'utf8');
    console.log(`✅ Dropbox copy`);
  }

  console.log(`\n📊 Issue #${issueNum} · ${unique.length} unique articles`);
  for (const [k, v] of Object.entries(sectioned)) console.log(`   ${k}: ${v.length}`);
}

generate().catch(e => { console.error('\n❌', e.message); process.exit(1); });
