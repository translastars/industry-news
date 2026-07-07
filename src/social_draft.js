/**
 * TranslaStars News — Social Media Draft Generator
 * Creates a draft post highlighting top 3 news from the daily page.
 * Run manually or via cron every 3 days to get post ideas.
 */
const https = require('https');
const http = require('http');

const PAGE_URL = 'https://translastars.github.io/industry-news/';

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }}, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => res.statusCode === 200 ? resolve(d) : reject(new Error('HTTP ' + res.statusCode)));
    }).on('error', reject);
  });
}

function stripHTML(s) {
  return s.replace(/<[^>]*>/g, '').replace(/&#[0-9]+;/g, ' ').replace(/&amp;/g, '&').trim();
}

async function generatePost() {
  const html = await fetch(PAGE_URL);

  // Extract article titles and sources from the HTML
  const articles = [];
  const cardRegex = /<article class="card">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = cardRegex.exec(html)) !== null) {
    const block = m[1];
    const titleMatch = block.match(/<h4>([\s\S]*?)<\/h4>/);
    const sourceMatch = block.match(/<span class="card-source">([\s\S]*?)<\/span>/);
    const linkMatch = block.match(/href="([^"]+)"[^>]*>Read more/);
    if (titleMatch && sourceMatch) {
      articles.push({
        title: stripHTML(titleMatch[1]),
        source: stripHTML(sourceMatch[1]),
        link: linkMatch ? linkMatch[1] : ''
      });
    }
  }

  // Also parse featured story
  const featMatch = html.match(/<article class="featured">([\s\S]*?)<\/article>/);
  if (featMatch) {
    const block = featMatch[1];
    const titleMatch = block.match(/<h2>([\s\S]*?)<\/h2>/);
    const sourceMatch = block.match(/<span class="feat-source"[^>]*>([\s\S]*?)<\/span>/);
    const linkMatch = block.match(/href="([^"]+)"[^>]*>Read full article/);
    if (titleMatch) {
      articles.unshift({
        title: stripHTML(titleMatch[1]),
        source: sourceMatch ? stripHTML(sourceMatch[1]) : '',
        link: linkMatch ? linkMatch[1] : ''
      });
    }
  }

  const top3 = articles.slice(0, 3);

  if (top3.length === 0) {
    console.log('No articles found. The page may not be deployed yet.');
    return;
  }

  console.log('\n📝 **DRAFT — LinkedIn Post (copy this)**\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`📰 **Industry News Update** 🚀\n`);
  console.log(`Here are this week's top stories from the localization & AI industry:\n`);

  top3.forEach((a, i) => {
    console.log(`${i + 1}. **${a.title.substring(0, 80)}**`);
    console.log(`   📍 ${a.source} → ${a.link ? 'Read: ' + a.link : 'See full list'}`);
    console.log('');
  });

  console.log(`🌐 **Explore all articles at the TranslaStars Industry News hub:**`);
  console.log(`👉 ${PAGE_URL}\n`);

  console.log(`Which story caught your eye? Drop a comment below! 👇\n`);
  console.log(`#Localization #AI #Translation #LanguageIndustry #TranslaStars\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📱 **Twitter/Threads version:**\n');
  console.log(`📰 Industry news update:\n`);
  top3.forEach((a, i) => {
    console.log(`${i + 1}. ${a.title.substring(0, 60)}`);
  });
  console.log(`\nFull list → ${PAGE_URL}`);
  console.log(`\n#Localization #AI #TranslaStars`);
}

generatePost().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
