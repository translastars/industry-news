# Changelog - Industry News (translastars/industry-news)

## v2.9 - 2026-08-22
- **FIX (Alfonso): blog posts no aparecen lo primero en la pagina**. Los posts del blog de TranslaStars se integran ahora en su seccion tematica relevante (Localization Industry / AI & Technology / Tools & Platforms / Global & Policy) segun el titulo (`classifyBlogSection`). Los que no encajan en ninguna seccion se muestran al final en la seccion "From the TranslaStars Blog" (id `ts-blog`).
- **FIX (Alfonso): imagenes reales de los blog posts**. `getTranslaStarsBlog()` ahora extrae la imagen del post (og:image -> twitter:image via `extractOGImage` -> primer `<img>` como fallback) y las tarjetas usan `b.image` en vez del placeholder SVG `genImg`.
- Nav: el enlace "Our Blog" solo aparece si hay posts sin clasificar al final.

## v2.8 - 2026-08-22
- **Blog section redesigned**: "📝 From the TranslaStars Blog" now renders as the same news cards (`.cd` grid) as the rest of the page (generated image header, "TranslaStars Blog" source pill, DD/MM/YYYY date, title, "Read article →") instead of a plain `<ul>` table-like list. Removed white box container + unused list CSS.

## v2.7 - 2026-08-22
- **New: "⭐ Today's Top Stories" section** (id `top-stories`): top 6 articles from the News Engine AI digest (`digest-latest.json`, 48h staleness guard; skipped gracefully if missing/stale). Purple gradient cards with source pill, 📊 Report badge for reports, relative date, 170-char excerpt, "Read article →" link.
- **New: "📝 From the TranslaStars Blog" section** (id `ts-blog`): blog posts published/updated this week (post-sitemap.xml `lastmod` within 7 days, up to 6), real titles fetched via og:title (slug-derived fallback with acronym map: AI, TMS, SEO, NLP, UX, UI, API, MT, memoQ, LSP, GPT, MQL, CRM, OpenClaw, DeepL, LLMs, vs). Dates DD/MM/YYYY (en-GB).
- Nav links: "Top Stories" + "Our Blog" anchors.
- Helpers in generate.js: `getDigest()`, `digestExcerpt()`, `getTranslaStarsBlog()`, `slugTitle()`, `shortDate()`.
- Build: 101 articles (Localization Industry / AI & Technology / Tools & Platforms / Global & Policy).
