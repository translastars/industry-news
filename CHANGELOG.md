# Changelog - Industry News (translastars/industry-news)

## v2.8 - 2026-08-22
- **Blog section redesigned**: "📝 From the TranslaStars Blog" now renders as the same news cards (`.cd` grid) as the rest of the page (generated image header, "TranslaStars Blog" source pill, DD/MM/YYYY date, title, "Read article →") instead of a plain `<ul>` table-like list. Removed white box container + unused list CSS.

## v2.7 - 2026-08-22
- **New: "⭐ Today's Top Stories" section** (id `top-stories`): top 6 articles from the News Engine AI digest (`digest-latest.json`, 48h staleness guard; skipped gracefully if missing/stale). Purple gradient cards with source pill, 📊 Report badge for reports, relative date, 170-char excerpt, "Read article →" link.
- **New: "📝 From the TranslaStars Blog" section** (id `ts-blog`): blog posts published/updated this week (post-sitemap.xml `lastmod` within 7 days, up to 6), real titles fetched via og:title (slug-derived fallback with acronym map: AI, TMS, SEO, NLP, UX, UI, API, MT, memoQ, LSP, GPT, MQL, CRM, OpenClaw, DeepL, LLMs, vs). Dates DD/MM/YYYY (en-GB).
- Nav links: "Top Stories" + "Our Blog" anchors.
- Helpers in generate.js: `getDigest()`, `digestExcerpt()`, `getTranslaStarsBlog()`, `slugTitle()`, `shortDate()`.
- Build: 101 articles (Localization Industry / AI & Technology / Tools & Platforms / Global & Policy).
