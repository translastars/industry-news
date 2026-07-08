const fs = require('fs');
const h = fs.readFileSync('C:\\Users\\barto\\.openclaw\\workspace\\industry-news\\docs\\index.html','utf8');

// Find all background-image occurrences
const re = /background-image:url\('[^']+'/g;
const matches = h.match(re);
if (matches) {
  const svgs = matches.filter(m => m.includes('data:image/svg'));
  const reals = matches.filter(m => !m.includes('svg'));
  console.log('Total image slots:', matches.length);
  console.log('SVG fallbacks:', svgs.length);
  console.log('Real images:', reals.length);
  reals.slice(0,3).forEach(m => console.log('  Real:', m.substring(0,120)));
} else {
  console.log('No background-image matches');
}
