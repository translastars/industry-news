// Check image status in generated HTML
const f = require('fs').readFileSync(
  'C:\\Users\\barto\\.openclaw\\workspace\\industry-news\\docs\\index.html', 'utf8');

const emptyImg = f.match(/background-image:url\(''\)/g);
console.log('Cards with empty image URL:', emptyImg ? emptyImg.length : 0);

const svgCards = f.match(/data:image\/svg\+xml/g);
console.log('Cards with SVG image:', svgCards ? svgCards.length : 0);

const featCards = f.match(/class="feat"/g);
console.log('Featured article sections:', featCards ? featCards.length : 0);

const featImg = f.match(/class="fi"[^>]*background-image/g);
console.log('Featured with bg image:', featImg ? featImg.length : 0);

// Check for data URIs in genImg results
const allBg = [...f.matchAll(/background-image:url\('([^']*)'\)/g)];
const withImg = allBg.filter(m => m[1].length > 0).length;
const withoutImg = allBg.filter(m => m[1].length === 0).length;
console.log('\nTotal background-image declarations:', allBg.length);
console.log('  With image URL:', withImg);
console.log('  Empty URL:', withoutImg);
console.log('  Sample URLs:', allBg.slice(0, 3).map(m => m[1].substring(0, 60)));
