/**
 * TranslaStars Industry News — Daily Generator v2.3
 * Changes from v2.2:
 *  - Content-aware images: icons/shapes based on article topics, not random circles
 *  - Source branding: color palettes + logo wordmarks in card images
 *  - Much tighter EU filtering (keep only explicit language/AI/digital mentions)
 *  - Expanded negative keywords to block more irrelevant content
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs');
const DROPBOX = path.join('C:\\Users\\barto\\Dropbox', 'OpenClaw Proyectos', 'Industry News');
const SITE = 'https://translastars.github.io/industry-news/';

// ── Industry relevance keywords ──
const KEYWORDS = [
  'translat', 'localization', 'localisation', 'localizing', 'localising',
  'interpret', 'languag', 'linguist', 'multilingual', 'subtitle',
  'caption', 'terminolog', 'transcreation', 'globalization', 'globalisation',
  'l10n', 'i18n',
  'machine translation', 'nmt', 'llm translat',
  'trados', 'memoq', 'crowdin', 'smartcat', 'phrase ', 'matecat',
  'wordfast', 'déjà vu',
  'natural language', 'nlp ', 'nlp,', 'speech', 'voice ',
  'text-to-speech', 'speech-to-text', 'whisper', 'transcri',
  'ai voice', 'ai agent', 'conversation', 'chatbot',
  'language model', 'large language', 'llm',
  'slator', 'nimdzi', 'elia ', 'gala ', 'taus ',
  'language industry', 'translation industry',
  'ecommerce', 'e-commerce', 'cross-border', 'internationaliz',
  'training', 'course', 'learning', 'education', 'student',
  'university', 'certification',
  'openai ', 'anthropic ', 'deepseek', 'claude ', 'gemini ',
  'copilot', 'chatgpt',
  'translator', 'translating', 'translate',
  'european commission', 'digital ', 'content moderation',
  'ai act', 'copyright', 'data act',
  // More specific for EU and general sources
  'digital single market', 'digital service', 'digital market',
  'ai regulation', 'artificial intelligence act',
  'media freedom', 'language technology',
  'computational linguistics',
];

// Negative keywords — expanded aggressively
const NEGATIVE = [
  'sport', 'football', 'soccer', 'nfl', 'nba', 'nhl', 'mlb', 'olymp',
  'gaming', 'video game', 'console', 'playstation', 'xbox', 'nintendo',
  'movie', 'film ', 'hollywood', 'celebrity', 'actor ', 'actress',
  'space ', 'rocket', 'mars ', 'nasa ', 'astronaut', 'spacex ', 'starship',
  'investing', 'stock ', 'crypto', 'bitcoin', 'nft ',
  'kitchen', 'recipe', 'food ', 'diet ', 'fitness', 'nutrition',
  'weather', 'hurricane', 'earthquake', 'tornado', 'wildfire', 'flood',
  'police', 'crime ', 'murder', 'shooting', 'protest', 'military',
  'music ', 'album', 'concert', 'song ', 'band ',
  'car ', 'vehicle', 'driverless car', 'autonomous vehicle', 'tesla ',
  'beauty', 'fashion', 'makeup',
  'real estate', 'housing market', 'mortgage',
  'pet ', 'dog ', 'cat ', 'veterinary',
  'gun ', 'weapon',
  'nuclear', 'missile',
  'cooking', 'travel ', 'tourism',
  'garden', 'plant ',
  'chronicle', 'obituary',
  'samsung', 'apple ', 'iphone', 'ipad', 'macbook', 'google pixel',
  'smartphone', 'tablet ', 'smartwatch',
  'battery', 'charging',
  'cyber monday', 'black friday',
  'quantum', 'cryptograph',
  '5g ', '6g ',
  'usb-c', 'hdmi',
  'netflix ', 'streaming',
  'instagram', 'tiktok', 'youtube ',
  'wine ', 'beer ', 'cocktail',
  'prison', 'court ',
  'pandemic', 'virus ', 'covid',
  'agriculture', 'fisheries', 'fishery',
  'energy ', 'renewable', 'solar ', 'wind farm', 'fossil fuel',
  'transport', 'railway', 'high-speed rail', 'aviation',
  'environment', 'climate ', 'emission', 'carbon',
  'health', 'medical', 'hospital', 'vaccine', 'disease',
  'food safety', 'food supplement', 'dietary supplement',
  'eurozone', 'inflation', 'interest rate', 'monetary policy',
  'defence', 'defense', 'army', 'naval',
  'migration', 'asylum', 'refugee', 'border control',
  'construction', 'infrastructure',
  'election', 'vot ', 'parliament', 'president',
  'sanction', 'tariff', 'trade war',
  'mortgage', 'loan', 'banking',
  'phone ', 'smartphone', 'android', 'ios',
  'chrome ', 'firefox', 'browser',
];

function matches(str, patterns) {
  if (!str) return false;
  const s = str.toLowerCase();
  return patterns.some(p => {
    const regex = new RegExp(p.toLowerCase().replace(/\?/g, '.'), 'i');
    return regex.test(s);
  });
}

// ── HTTP fetch ──
function fetch(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    let cancelled = false;
    const req = mod.get(url, { timeout: 12000, headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }}, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return _fetch_simple(new URL(res.headers.location, url).href).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => { if (!cancelled) chunks.push(c); });
      res.on('end', () => { if (!cancelled) resolve(Buffer.concat(chunks).toString()); });
    });
    req.on('error', reject);
    req.on('timeout', () => { cancelled = true; req.destroy(); reject(new Error('Timeout')); });
  });
}
function _fetch_simple(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return _fetch(url); }
    catch (e) { if (i === retries) throw e; }
  }
}
function _fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    let cancelled = false;
    const req = mod.get(url, { timeout: 12000, headers: {
      'User-Agent': 'Mozilla/5.0'
    }}, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return _fetch(new URL(res.headers.location, url).href).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
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
    const desc = g('description').replace(/<[^>]*>/g, '').substring(0, 400);
    const img = (b.match(/<media:content[^>]*url="([^"]+)"/i) ||
                 b.match(/<enclosure[^>]*url="([^"]+)"/i) ||
                 b.match(/<media:thumbnail[^>]*url="([^"]+)"/i) || [])[1] || '';
    if (title && link && title.length > 5) {
      items.push({ title: strip(title), link, date: date ? new Date(date).toISOString() : '', excerpt: desc, image: img });
    }
  }
  return items;
}

function strip(s) { return s ? s.replace(/<[^>]*>/g, '').replace(/&#[0-9]+;/g, ' ').replace(/&amp;/g, '&').trim() : ''; }
function trunc(s, max) { const c = strip(s); return c.length > max ? c.substring(0, max) + '…' : c; }
function relDate(d) {
  const now = Date.now(), date = new Date(d).getTime();
  if (isNaN(date)) return '';
  const days = Math.floor((now - date) / 86400000);
  if (days < 0) return 'Today';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDate(d) { return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

// ── Source brand configs (v2.3) ──
const BRANDS = {
  'Slator':                { bg1: '#1a73e8', bg2: '#0d47a1', logo: 'SL', logoColor: '#fff', shape: 'bar' },
  'Nimdzi':                { bg1: '#e63946', bg2: '#9b2226', logo: 'ND', logoColor: '#fff', shape: 'pie' },
  'ELIA':                  { bg1: '#2a9d8f', bg2: '#1b6d63', logo: 'EL', logoColor: '#fff', shape: 'net' },
  'IAPTI':                 { bg1: '#8b5cf6', bg2: '#6d28d9', logo: 'IA', logoColor: '#fff', shape: 'doc' },
  'EST':                   { bg1: '#6b7280', bg2: '#374151', logo: 'ES', logoColor: '#fff', shape: 'book' },
  'TechCrunch':            { bg1: '#0a9e01', bg2: '#0d7300', logo: 'TC', logoColor: '#fff', shape: 'circuit' },
  'CNBC Tech':             { bg1: '#005da3', bg2: '#003b6f', logo: 'CN', logoColor: '#fff', shape: 'bar' },
  'Wired':                 { bg1: '#000000', bg2: '#1a1a1a', logo: 'WI', logoColor: '#ff3c00', shape: 'wave' },
  'The Guardian':          { bg1: '#052962', bg2: '#031b3d', logo: 'Gd', logoColor: '#fff', shape: 'doc' },
  'BBC Technology':        { bg1: '#bb1919', bg2: '#7a0f0f', logo: 'BB', logoColor: '#fff', shape: 'globe' },
  'Unbabel':               { bg1: '#00a3ff', bg2: '#0077b6', logo: 'Un', logoColor: '#fff', shape: 'net' },
  'OneSky':                { bg1: '#ff6b35', bg2: '#cc4400', logo: 'OS', logoColor: '#fff', shape: 'globe' },
  'POEditor':              { bg1: '#512da8', bg2: '#311b92', logo: 'PO', logoColor: '#fff', shape: 'doc' },
  'Welocalize':            { bg1: '#0077b6', bg2: '#004e7c', logo: 'WL', logoColor: '#fff', shape: 'globe' },
  'EU Commission':         { bg1: '#003399', bg2: '#001a4d', logo: 'EU', logoColor: '#feda4a', shape: 'building' },
  'TWB':                   { bg1: '#e76f51', bg2: '#c14c33', logo: 'TW', logoColor: '#fff', shape: 'globe' },
  'Translation Commons':   { bg1: '#264653', bg2: '#1a3333', logo: 'TC', logoColor: '#e9c46a', shape: 'net' },
};

// ── Content-aware icon SVGs (v2.3) ──
function detectTopics(title, excerpt) {
  const text = `${title} ${excerpt}`.toLowerCase();
  const topics = [];
  if (/ai |artificial intelligence|machine learning|neural|deep learn|llm |gpt|chatgpt|openai|claude |gemini|anthropic|deepseek/.test(text)) {
    topics.push({ icon: 'brain', label: 'AI' });
  }
  if (/translat|locali|languag|interpret|linguist|subtitle|caption|multilingual|l10n|i18n/.test(text)) {
    topics.push({ icon: 'bubble', label: 'Language' });
  }
  if (/fund|invest|acquir|merger|revenue|earnings|market|growth|startup|valuation|ipo/.test(text)) {
    topics.push({ icon: 'chart', label: 'Business' });
  }
  if (/regulation|policy|act |law |compliance|governance|government|eu |european/.test(text)) {
    topics.push({ icon: 'building', label: 'Policy' });
  }
  if (/research|study|survey|report|findings|academic|paper |journal/.test(text)) {
    topics.push({ icon: 'research', label: 'Research' });
  }
  if (/tool|software|platform|api |app |plugin|integration|feature|update|launch/.test(text)) {
    topics.push({ icon: 'tool', label: 'Tools' });
  }
  if (/training|education|course|learning|student|university|certif/.test(text)) {
    topics.push({ icon: 'edu', label: 'Education' });
  }
  if (/global|worldwide|internation|cross.border|globaliz/.test(text)) {
    topics.push({ icon: 'globe', label: 'Global' });
  }
  if (/speech|voice |tts|stt|whisper|audio|transcri|conversation|chatbot/.test(text)) {
    topics.push({ icon: 'wave', label: 'Speech' });
  }
  if (/content|media|publish|blog|article|news|journalism/.test(text)) {
    topics.push({ icon: 'doc', label: 'Content' });
  }
  if (/partner|collaboration|alliance|team|acqui.hire|join|appoint/.test(text)) {
    topics.push({ icon: 'people', label: 'People' });
  }
  // Default if nothing matched
  if (topics.length === 0) topics.push({ icon: 'bubble', label: 'Language' });
  return topics;
}

// Icon renderers — each returns SVG elements
const ICONS = {
  brain: `<g transform="translate(290,130)">
    <path d="M0,-50 C30,-50 50,-30 50,0 C50,20 38,36 20,42 L20,60 L-20,60 L-20,42 C-38,36 -50,20 -50,0 C-50,-30 -30,-50 0,-50Z" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <path d="M-15,15 Q0,-20 15,15" stroke="rgba(255,255,255,0.18)" fill="none" stroke-width="2" stroke-linecap="round"/>
    <path d="M-25,0 Q0,-30 25,0" stroke="rgba(255,255,255,0.12)" fill="none" stroke-width="2" stroke-linecap="round"/>
    <circle cx="-12" cy="5" r="3" fill="rgba(255,255,255,0.15)"/>
    <circle cx="12" cy="5" r="3" fill="rgba(255,255,255,0.15)"/>
  </g>`,
  bubble: `<g transform="translate(290,120)">
    <rect x="-35" y="-25" width="70" height="45" rx="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <path d="M6,20 L12,32 L-6,20" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <circle cx="-12" cy="-5" r="2.5" fill="rgba(255,255,255,0.2)"/>
    <circle cx="0" cy="-5" r="2.5" fill="rgba(255,255,255,0.2)"/>
    <circle cx="12" cy="-5" r="2.5" fill="rgba(255,255,255,0.2)"/>
    <line x1="-20" y1="6" x2="20" y2="6" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  </g>`,
  chart: `<g transform="translate(290,130)">
    <rect x="-30" y="15" width="60" height="5" rx="2" fill="rgba(255,255,255,0.1)"/>
    <rect x="-25" y="0" width="12" height="30" rx="2" fill="rgba(255,255,255,0.15)"/>
    <rect x="-7" y="-10" width="12" height="40" rx="2" fill="rgba(255,255,255,0.2)"/>
    <rect x="11" y="5" width="14" height="25" rx="2" fill="rgba(255,255,255,0.15)"/>
    <path d="M-8,15 L2,-5 L12,5" stroke="rgba(255,255,255,0.25)" fill="none" stroke-width="2" stroke-linecap="round"/>
    <circle cx="2" cy="-5" r="3" fill="rgba(255,255,255,0.3)"/>
  </g>`,
  building: `<g transform="translate(290,125)">
    <rect x="-25" y="-15" width="50" height="50" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <rect x="-15" y="-5" width="8" height="12" rx="1" fill="rgba(255,255,255,0.15)"/>
    <rect x="-3" y="-5" width="8" height="12" rx="1" fill="rgba(255,255,255,0.15)"/>
    <rect x="9" y="-5" width="8" height="12" rx="1" fill="rgba(255,255,255,0.15)"/>
    <rect x="-15" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.12)"/>
    <rect x="-3" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.12)"/>
    <rect x="9" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.12)"/>
    <polygon points="-40,35 -15,20 15,20 40,35" fill="rgba(255,255,255,0.06)"/>
  </g>`,
  research: `<g transform="translate(290,125)">
    <circle cx="-12" cy="-10" r="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <line x1="0" y1="4" x2="18" y2="22" stroke="rgba(255,255,255,0.15)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="-12" cy="-10" r="4" fill="rgba(255,255,255,0.2)"/>
    <line x1="-22" y1="-12" x2="-2" y2="-12" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
    <line x1="-20" y1="-6" x2="-4" y2="-6" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  </g>`,
  tool: `<g transform="translate(290,125)">
    <circle cx="-8" cy="-8" r="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <circle cx="-8" cy="-8" r="5" fill="rgba(255,255,255,0.18)"/>
    <circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.14)"/>
    <line x1="4" y1="-4" x2="6" y2="6" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
  </g>`,
  edu: `<g transform="translate(290,125)">
    <path d="M-30,0 Q0,-20 30,0 L20,25 L-20,25Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <rect x="-20" y="0" width="40" height="25" rx="2" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <line x1="-14" y1="8" x2="14" y2="8" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <line x1="-12" y1="14" x2="12" y2="14" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
    <line x1="-10" y1="20" x2="10" y2="20" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>
    <circle cx="0" cy="-12" r="6" fill="rgba(255,255,255,0.12)"/>
  </g>`,
  globe: `<g transform="translate(290,125)">
    <circle cx="0" cy="0" r="32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <ellipse cx="0" cy="0" rx="18" ry="32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <line x1="-32" y1="0" x2="32" y2="0" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <path d="M-25,15 Q0,22 25,15" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <path d="M-25,-15 Q0,-22 25,-15" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  </g>`,
  wave: `<g transform="translate(290,125)">
    <circle cx="0" cy="-15" r="22" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <path d="M-15,-5 Q-8,-18 0,-8 Q8,-18 15,-5" stroke="rgba(255,255,255,0.2)" fill="none" stroke-width="2" stroke-linecap="round"/>
    <path d="M-20,5 Q-10,-8 0,2 Q10,-8 20,5" stroke="rgba(255,255,255,0.12)" fill="none" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="0" cy="-15" r="3" fill="rgba(255,255,255,0.2)"/>
  </g>`,
  doc: `<g transform="translate(290,120)">
    <path d="M-25,-20 L15,-20 L25,-10 L25,25 L-25,25Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <line x1="15" y1="-20" x2="15" y2="-10" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <line x1="25" y1="-10" x2="15" y2="-10" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <line x1="-15" y1="-5" x2="15" y2="-5" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <line x1="-15" y1="5" x2="15" y2="5" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
    <line x1="-15" y1="15" x2="10" y2="15" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>
  </g>`,
  people: `<g transform="translate(290,125)">
    <circle cx="-14" cy="-10" r="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <circle cx="16" cy="-10" r="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <ellipse cx="-14" cy="20" rx="18" ry="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <ellipse cx="16" cy="20" rx="18" ry="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="-10" y1="-10" x2="12" y2="-10" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  </g>`,
  circuit: `<g transform="translate(290,125)">
    <rect x="-30" y="-25" width="18" height="18" rx="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <rect x="12" y="-25" width="18" height="18" rx="3" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <rect x="-9" y="7" width="18" height="18" rx="3" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    <line x1="-12" y1="-16" x2="12" y2="-16" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
    <line x1="0" y1="-7" x2="0" y2="7" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
    <circle cx="-21" cy="-34" r="2" fill="rgba(255,255,255,0.12)"/>
    <circle cx="0" cy="-34" r="2" fill="rgba(255,255,255,0.1)"/>
    <circle cx="21" cy="-34" r="2" fill="rgba(255,255,255,0.08)"/>
    <circle cx="-30" cy="-7" r="2" fill="rgba(255,255,255,0.1)"/>
    <circle cx="30" cy="-7" r="2" fill="rgba(255,255,255,0.08)"/>
  </g>`,
  net: `<g transform="translate(290,125)">
    <circle cx="-18" cy="-14" r="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <circle cx="20" cy="-14" r="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <circle cx="2" cy="22" r="8" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <line x1="-12" y1="-10" x2="14" y2="-10" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="-10" y1="-8" x2="0" y2="18" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <line x1="14" y1="-8" x2="8" y2="18" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  </g>`,
  pie: `<g transform="translate(290,125)">
    <circle cx="0" cy="0" r="30" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <path d="M0,0 L0,-30 A30,30 0 0,1 26,-15Z" fill="rgba(255,255,255,0.14)"/>
    <path d="M0,0 L26,-15 A30,30 0 0,1 15,26Z" fill="rgba(255,255,255,0.1)"/>
    <path d="M0,0 L15,26 A30,30 0 0,1 -15,26Z" fill="rgba(255,255,255,0.06)"/>
    <path d="M0,0 L-15,26 A30,30 0 0,1 -26,-15Z" fill="rgba(255,255,255,0.04)"/>
  </g>`,
  book: `<g transform="translate(290,125)">
    <rect x="-28" y="-20" width="22" height="45" rx="2" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <rect x="-6" y="-20" width="22" height="45" rx="2" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    <line x1="-22" y1="-10" x2="-10" y2="-10" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <line x1="-22" y1="-2" x2="-10" y2="-2" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <line x1="-22" y1="6" x2="-10" y2="6" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  </g>`,
  bar: `<g transform="translate(290,130)">
    <rect x="-28" y="5" width="12" height="28" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <rect x="-6" y="-5" width="12" height="38" rx="2" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <rect x="16" y="10" width="12" height="23" rx="2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <line x1="-36" y1="0" x2="36" y2="0" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  </g>`,
};

// ── Content-aware abstract image generator (v2.3) ──
function genImg(title, excerpt, source, section) {
  const brand = BRANDS[source] || { bg1: '#522D6D', bg2: '#7B3FAF', logo: 'TS', logoColor: '#fff', shape: 'bubble' };
  const topics = detectTopics(title, excerpt);
  const primaryTopic = topics[0];
  const iconSvg = ICONS[primaryTopic?.icon] || ICONS.bubble;
  
  // Decorative shapes based on source brand
  let decorative = '';
  if (brand.shape === 'net' || brand.shape === 'circuit') {
    decorative = `<line x1="${50+Math.abs(title.length*7%100)}" y1="${20+Math.abs(title.length*13%60)}" x2="${150+Math.abs(title.length*3%200)}" y2="${80+Math.abs(title.length*11%100)}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <circle cx="${80+Math.abs(title.length*17%250)}" cy="${100+Math.abs(title.length*5%150)}" r="${5+Math.abs(title.length%15)}" fill="rgba(255,255,255,0.04)"/>`;
  } else {
    decorative = `<circle cx="${100+Math.abs(title.length*7%300)}" cy="${60+Math.abs(title.length*13%200)}" r="${30+Math.abs(title.length%40)}" fill="rgba(255,255,255,0.04)"/>
    <circle cx="${300+Math.abs(title.length*11%200)}" cy="${180+Math.abs(title.length*5%100)}" r="${20+Math.abs(title.length*3%30)}" fill="rgba(255,255,255,0.03)"/>`;
  }

  // Topic label at bottom
  const topicLabel = topics.slice(0, 2).map(t => t.label).join(' · ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${brand.bg1}"/>
      <stop offset="100%" style="stop-color:${brand.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="320" fill="url(#g)"/>
  ${decorative}
  <!-- Source logo wordmark -->
  <text x="24" y="34" fill="${brand.logoColor}" font-family="'Montserrat','Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="22" letter-spacing="2" opacity="0.5">${brand.logo}</text>
  <!-- Content-aware icon -->
  ${iconSvg}
  <!-- Topic label -->
  <text x="300" y="300" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-family="'Montserrat','Helvetica Neue',Arial,sans-serif" font-size="10" font-weight="600" letter-spacing="2">${topicLabel}</text>
</svg>`;
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// ── Sources ──
const SRC = [
  { name: 'Slator',        url: 'https://slator.com/feed/',                    color: '#1a73e8', sec: 'Localization Industry' },
  { name: 'Nimdzi',        url: 'https://www.nimdzi.com/feed/',                color: '#e63946', sec: 'Localization Industry' },
  { name: 'ELIA',          url: 'https://elia-association.org/feed/',          color: '#2a9d8f', sec: 'Localization Industry' },
  { name: 'IAPTI',         url: 'https://iapti.org/feed/',                     color: '#8b5cf6', sec: 'Localization Industry' },
  { name: 'EST',           url: 'https://est-translationstudies.org/feed/',    color: '#6b7280', sec: 'Localization Industry' },
  { name: 'TechCrunch',    url: 'https://techcrunch.com/feed/',                color: '#0a9e01', sec: 'AI & Technology' },
  { name: 'CNBC Tech',     url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', color: '#005da3', sec: 'AI & Technology' },
  { name: 'Wired',         url: 'https://www.wired.com/feed/rss',              color: '#000',    sec: 'AI & Technology' },
  { name: 'The Guardian',  url: 'https://www.theguardian.com/technology/rss',  color: '#052962', sec: 'AI & Technology' },
  { name: 'BBC Technology',url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', color: '#bb1919', sec: 'AI & Technology' },
  { name: 'Unbabel',       url: 'https://unbabel.com/feed/',                  color: '#00a3ff', sec: 'Tools & Platforms' },
  { name: 'OneSky',        url: 'https://www.oneskyapp.com/feed/',            color: '#ff6b35', sec: 'Tools & Platforms' },
  { name: 'POEditor',      url: 'https://poeditor.com/blog/feed/',            color: '#512da8', sec: 'Tools & Platforms' },
  { name: 'Welocalize',    url: 'https://www.welocalize.com/feed/',           color: '#0077b6', sec: 'Tools & Platforms' },
  { name: 'EU Commission', url: 'https://ec.europa.eu/commission/presscorner/api/rss?type=IP&language=en', color: '#003399', sec: 'Global & Policy' },
  { name: 'TWB',           url: 'https://translatorswithoutborders.org/feed/', color: '#e76f51', sec: 'Global & Policy' },
  { name: 'Translation Commons', url: 'https://translationcommons.org/feed/', color: '#264653', sec: 'Global & Policy' },
];

async function getSource(name, url, color, sec) {
  try {
    const xml = await fetch(url);
    const items = parseRSS(xml);
    if (!items.length) { console.log(`  ~ ${name}: 0 items`); return []; }
    let filtered = items.map(i => ({
      title: i.title, link: i.link, date: i.date, excerpt: strip(i.excerpt), image: i.image,
      source: name, sourceColor: color, section: sec, relativeDate: relDate(i.date),
    }));
    // Industry sources keep all articles; general sources need keyword match
    if (['TechCrunch','CNBC Tech','Wired','The Guardian','BBC Technology','EU Commission'].includes(name)) {
      const before = filtered.length;
      filtered = filtered.filter(a => {
        const text = `${a.title} ${a.excerpt}`;
        const pos = matches(text, KEYWORDS);
        const neg = matches(text, NEGATIVE);
        return pos && !neg;
      });
      console.log(`  ✓ ${name}: ${filtered.length}/${before} relevant`);
    } else {
      console.log(`  ✓ ${name}: ${filtered.length} articles`);
    }
    return filtered;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message.substring(0,50)}`);
    return [];
  }
}

// ── Main ──
async function gen() {
  console.log('📰 TranslaStars Industry News — Daily Edition v2.3\n');

  const all = [];
  for (const s of SRC) {
    const a = await getSource(s.name, s.url, s.color, s.sec);
    all.push(...a);
  }

  all.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date);
    if (isNaN(da.getTime()) && isNaN(db.getTime())) return 0;
    if (isNaN(da.getTime())) return 1; if (isNaN(db.getTime())) return -1;
    return db - da;
  });

  // Dedup
  const seen = new Set();
  const unique = [];
  for (const a of all) {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 35);
    if (!seen.has(key)) { seen.add(key); unique.push(a); }
  }

  const today = new Date();
  const top = unique[0] || null;
  const secs = ['Localization Industry', 'AI & Technology', 'Tools & Platforms', 'Global & Policy'];
  const secd = {};
  secs.forEach(s => secd[s] = unique.filter(a => a.section === s));

  // ── HTML (v2.3) ──
  const h = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TranslaStars Industry News</title>
<meta name="description" content="Daily curated news for language, localization, and AI professionals.">
<meta property="og:title" content="TranslaStars Industry News">
<meta property="og:description" content="Curated daily for localization & AI professionals.">
<meta property="og:url" content="${SITE}">
<link rel="shortcut icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📰%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&amp;display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}html{font-size:16px}
body{font-family:'Montserrat',-apple-system,sans-serif;background:#f7f5f2;color:#111;line-height:1.6;-webkit-font-smoothing:antialiased}
.masthead{background:#fff;border-bottom:3px solid #522D6D;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
.mh{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.mh .logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.mh .logo svg{width:32px;height:32px}
.mh .logo-text{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:700;color:#522D6D;letter-spacing:-.3px}
.mh .logo-text span{color:#FF6B00}
.mh nav{display:flex;gap:14px;flex-wrap:wrap}
.mh nav a{font-size:11px;font-weight:600;color:#555;text-decoration:none;text-transform:uppercase;letter-spacing:1px;transition:color .2s}
.mh nav a:hover{color:#522D6D}
@media(max-width:640px){.mh{flex-direction:column;gap:6px;padding:10px 16px}.mh nav{gap:8px;justify-content:center}}
.hero{background:linear-gradient(135deg,#522D6D 0%,#7B3FAF 50%,#9b5de5 100%);color:#fff;padding:44px 24px 32px;text-align:center}
.hero h1{font-family:'Montserrat',sans-serif;font-size:42px;font-weight:900;letter-spacing:-1.5px;margin-bottom:6px;line-height:1.1}
.hero .tag{font-size:15px;opacity:.8;font-weight:300;max-width:480px;margin:0 auto}
.hero .meta{display:flex;justify-content:center;gap:22px;margin-top:16px;font-size:12px;opacity:.65;border-top:1px solid rgba(255,255,255,.12);padding-top:14px;flex-wrap:wrap}
@media(max-width:640px){.hero h1{font-size:28px}.hero{padding:30px 16px 20px}.hero .meta{gap:10px;font-size:11px}}
.container{max-width:1200px;margin:0 auto;padding:28px 24px}
@media(max-width:640px){.container{padding:16px}}
.sbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:24px;padding:10px 16px;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.04);align-items:center}
.sbar .lb{font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-right:6px}
.sbar .pill{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:500;color:#555;padding:2px 8px;border-radius:4px;background:#f5f5f5}
.sbar .pill .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
.sbar .cnt{font-size:10px;color:#999;margin-left:auto}
.feat{display:grid;grid-template-columns:1.2fr 1fr;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.05);margin-bottom:28px;min-height:380px}
.feat .fi{background-size:cover;background-position:center;min-height:380px;position:relative}
.feat .fi .o{position:absolute;inset:0;background:linear-gradient(135deg,rgba(82,45,109,.35),transparent 60%)}
.feat .fb{padding:36px;display:flex;flex-direction:column;justify-content:center}
.feat .fs{display:inline-block;background:#f0ecf5;color:#522D6D;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;border-radius:4px;margin-bottom:12px;align-self:flex-start}
.feat h2{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:700;line-height:1.3;margin-bottom:12px}
.feat .fe{font-size:14px;color:#555;line-height:1.7;margin-bottom:14px}
.feat .fm{font-size:12px;color:#999;margin-bottom:14px}
.feat .fcta{display:inline-flex;align-items:center;gap:6px;background:#522D6D;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;transition:all .2s;align-self:flex-start}
.feat .fcta:hover{background:#7B3FAF;transform:translateY(-1px);box-shadow:0 4px 12px rgba(82,45,109,.3)}
@media(max-width:768px){
  .feat{grid-template-columns:1fr}
  .feat .fi{min-height:200px}
  .feat .fi .o{background:linear-gradient(0deg,rgba(82,45,109,.3),transparent 50%)}
  .feat .fb{padding:24px}
  .feat h2{font-size:22px}
}
.sh{display:flex;align-items:center;margin-bottom:16px;padding-bottom:8px;border-bottom:3px solid #522D6D;flex-wrap:wrap}
.sh h3{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:700;color:#522D6D}
.sh .sc{font-size:12px;color:#999;margin-left:8px;font-weight:400}
.sh .tag{font-size:10px;margin-left:12px;padding:2px 10px;border-radius:10px;background:#f0ecf5;color:#522D6D;font-weight:600}
.gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;margin-bottom:30px}
@media(max-width:640px){.gr{grid-template-columns:1fr}}
.cd{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.05);transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column}
.cd:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.08)}
.cd .ci{height:160px;background-size:cover;background-position:center;background-color:#f0ecf5;position:relative}
.cd .ci .ct{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.55);color:#fff;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:4px}
.cd .cb{padding:16px;flex:1;display:flex;flex-direction:column}
.cd .ctop{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.cd .cs{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#522D6D}
.cd .cda{font-size:11px;color:#999}
.cd h4{font-family:'Montserrat',sans-serif;font-size:15px;font-weight:700;line-height:1.35;margin-bottom:6px}
.cd .ctxt{font-size:13px;color:#666;line-height:1.6;flex:1;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cd .cl{color:#522D6D;text-decoration:none;font-weight:600;font-size:12px;display:inline-flex;align-items:center;gap:3px}
.cd .cl:hover{color:#7B3FAF;text-decoration:underline}
.emp{background:#fff;border-radius:12px;padding:40px;text-align:center;color:#999;grid-column:1/-1}
.view-all-wrap{text-align:center;margin-top:-16px;margin-bottom:24px}
.view-all-btn{display:inline-flex;align-items:center;gap:6px;background:#f0ecf5;color:#522D6D;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:600;padding:8px 20px;border:none;border-radius:8px;cursor:pointer;transition:all .2s}
.view-all-btn:hover{background:#e0d6f0;transform:translateY(-1px)}
.ft{background:#1a1a2e;color:#999;padding:32px 24px;text-align:center;margin-top:16px}
.ft .in{max-width:600px;margin:0 auto}
.ft a{color:#7B3FAF;text-decoration:none}
.ft a:hover{text-decoration:underline}
.ft p{font-size:12px;line-height:1.8}
.ft .pw{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;opacity:.5}
</style>
</head>
<body>
<header class="masthead">
  <div class="mh">
    <a href="${SITE}" class="logo">
      <svg viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#522D6D"/><text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold" font-size="16">TS</text></svg>
      <span class="logo-text">TranslaStars <span>News</span></span>
    </a>
    <nav>
      <a href="#Localization-Industry">Industry</a>
      <a href="#AI-Technology">AI &amp; Tech</a>
      <a href="#Tools-Platforms">Tools</a>
      <a href="#Global-Policy">Global</a>
      <a href="https://www.translastars.com" target="_blank" style="color:#FF6B00">TranslaStars →</a>
    </nav>
  </div>
</header>
<section class="hero">
  <h1>Industry News</h1>
  <p class="tag">Curated daily for language, localization &amp; AI professionals</p>
  <div class="meta">
    <span>${fmtDate(today)}</span>
    <span>${unique.length} articles</span>
    <span>${SRC.length} sources</span>
  </div>
</section>
<div class="container">
<div class="sbar">
  <span class="lb">Sources</span>
  ${SRC.map(s => `<span class="pill"><span class="dot" style="background:${s.color}"></span>${s.name}</span>`).join('')}
  <span class="cnt">Daily</span>
</div>

${top ? `<article class="feat">
  <div class="fi" style="background-image:url('${top.image || genImg(top.title, top.excerpt, top.source, top.section)}')"><div class="o"></div></div>
  <div class="fb">
    <span class="fs" style="color:${top.sourceColor}">${top.source}</span>
    <h2>${top.title}</h2>
    <p class="fe">${trunc(top.excerpt, 200)}</p>
    <div class="fm">${top.relativeDate}</div>
    <a href="${top.link}" target="_blank" rel="noopener" class="fcta">Read full article →</a>
  </div>
</article>` : ''}

${secs.map((s, si) => {
  const a = secd[s] || [];
  if (!a.length) return '';
  const id = s.replace(/[&\s]+/g, '-').replace(/-+/g, '-');
  const LIMIT = 12;
  const visible = a.slice(0, LIMIT);
  const hidden = a.slice(LIMIT);
  return `
<section id="${id}">
  <div class="sh">
    <h3>${s}</h3>
    <span class="sc">(${a.length} articles)</span>
  </div>
  <div class="gr" id="grid-${si}">
    ${visible.map(art => {
      const imgUrl = art.image || genImg(art.title, art.excerpt, art.source, art.section);
      return `
    <article class="cd">
      <div class="ci" style="background-image:url('${imgUrl}')">
        <span class="ct">${art.source}</span>
      </div>
      <div class="cb">
        <div class="ctop">
          <span class="cs">${art.source}</span>
          <span class="cda">${art.relativeDate}</span>
        </div>
        <h4>${art.title}</h4>
        <p class="ctxt">${trunc(art.excerpt, 110)}</p>
        <a href="${art.link}" target="_blank" rel="noopener" class="cl">Read more →</a>
      </div>
    </article>`;
    }).join('\n    ')}
    ${hidden.length > 0 ? hidden.map(art => {
      const imgUrl = art.image || genImg(art.title, art.excerpt, art.source, art.section);
      return `
    <article class="cd" style="display:none" class="hidden-${si}">
      <div class="ci" style="background-image:url('${imgUrl}')">
        <span class="ct">${art.source}</span>
      </div>
      <div class="cb">
        <div class="ctop">
          <span class="cs">${art.source}</span>
          <span class="cda">${art.relativeDate}</span>
        </div>
        <h4>${art.title}</h4>
        <p class="ctxt">${trunc(art.excerpt, 110)}</p>
        <a href="${art.link}" target="_blank" rel="noopener" class="cl">Read more →</a>
      </div>
    </article>`;
    }).join('\n    ') : ''}
  </div>
  ${hidden.length > 0 ? `<div class="view-all-wrap"><button class="view-all-btn" onclick="(function(){var g=document.getElementById('grid-${si}'),cards=g.querySelectorAll('.cd'),hidden=[];for(var i=0;i<cards.length;i++){if(cards[i].style.display==='none')hidden.push(cards[i]);}var show=hidden.splice(0,${LIMIT});show.forEach(function(c){c.style.display='flex'});if(hidden.length===0){this.textContent='Show all ${a.length} articles';this.disabled=true;this.style.opacity='0.4';}})()">Show all ${a.length} articles (${hidden.length} more) ↓</button></div>` : ''}
</section>`}).join('\n\n')}

</div>
<footer class="ft">
  <div class="in">
    <p><strong style="color:#fff">TranslaStars Industry News</strong> — Daily curated for language, localization & AI professionals</p>
    <p style="margin-top:4px"><a href="https://www.translastars.com" target="_blank">TranslaStars</a> · <a href="https://github.com/translastars/industry-news" target="_blank">GitHub</a> · <a href="${SITE}">Home</a></p>
    <p style="margin-top:4px;font-size:11px">News curated automatically from public RSS feeds. Only industry-relevant articles shown.</p>
    <div class="pw">Generated ${today.toISOString().substring(0,19).replace('T',' ')} · Powered by TranslaStars AI ✦</div>
  </div>
</footer>
</body>
</html>`;

  // Write
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), h, 'utf8');
  console.log(`\n✅ docs/index.html (${Buffer.byteLength(h, 'utf8').toLocaleString()} bytes)`);

  if (fs.existsSync(DROPBOX)) {
    if (!fs.existsSync(DROPBOX)) fs.mkdirSync(DROPBOX, { recursive: true });
    fs.writeFileSync(path.join(DROPBOX, 'index.html'), h, 'utf8');
    console.log('✅ Dropbox copy');
  }

  console.log(`\n📊 ${unique.length} unique articles across ${secs.length} sections`);
  for (const [k, v] of Object.entries(secd)) console.log(`   ${k}: ${v.length}`);
}

gen().catch(e => { console.error('\n❌', e.message); process.exit(1); });
