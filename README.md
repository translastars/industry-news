# TranslaStars Industry News 📰

Daily curated news for language, localization & AI professionals.

**Live at:** https://translastars.github.io/industry-news/

## Features

- **Daily updates** via GitHub Actions
- **15+ sources**: Slator, Nimdzi, GALA, TAUS, MultiLingual, The Guardian, El País English, EU Commission, WEF, ISO, UNESCO, and more
- **Auto-generated reports**: EU press releases, organizational announcements
- **Professional newspaper design** with sections for Industry, World News, and Policy
- **All content in English**
- **Responsive** — works on desktop and mobile

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Generation | Node.js (vanilla, no deps) |
| Hosting | GitHub Pages |
| Automation | GitHub Actions (cron daily) |
| News sources | RSS feeds, WP-API |

## Local Development

```bash
node src/generate.js
```

This generates `docs/index.html`. Open it in a browser.

## Adding a Source

Edit `src/generate.js` — add to the `SOURCES` array:

```js
{
  name: 'Your Source',
  type: 'rss',        // or 'wpapi'
  url: 'https://...',
  color: '#hexcode',
  section: 'Industry'  // Industry, World News, or Policy
}
```

## License

© TranslaStars — Internal use.
