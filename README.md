# Noor – Islamic Companion (Web)

Responsive React + TypeScript + Vite frontend.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Current integrations

- Prayer times: AlAdhan API (existing integration in `src/lib/islamic.ts`).
- Duas: UmmahAPI `GET https://ummahapi.com/api/duas`. The app fetches the collection when the Duas tab opens, then filters locally on each keystroke so one-letter searches feel instant. If the API is unavailable, the small bundled sample is shown and a notice is displayed.
- Quran: AlQuran Cloud API `GET https://api.alquran.cloud/v1/surah` for all 114 Surahs and `GET /surah/{number}/editions/quran-uthmani,en.sahih` for Arabic text and English meaning of the selected Surah.

## Search behaviour

- Duas: searches title, category, transliteration, translation and Arabic text. Single English letters match titles/transliterations that begin with that letter (for example A or B). Search is client-side after the collection is loaded.
- Quran: searches all loaded Surah metadata by number, Arabic name, English transliteration, English meaning and revelation place.

## Deployment

Netlify build command: `npm run build`
Publish directory: `dist`

## Important content and licensing notes

- Quran API content is fetched live; an internet connection is required. Check the current API and translation terms before commercial redistribution. The English Saheeh International translation is a translation of the meaning and should not be represented as the Arabic Quran.
- Dua records and their references are provided by UmmahAPI. Review each Arabic text, transliteration, translation and hadith/Quran reference with qualified reviewers before public release.
- No backend database is required for the current frontend demo. Search state is held in browser memory; the selected dark/light theme is saved in localStorage.


## v7 location selectors and light theme
- Location preferences now use cascading Country → State/Province → City selectors powered by `country-state-city` package data.
- Changing a country clears the selected state and city. Changing a state clears the selected city.
- Light theme uses warm ivory, soft sage and champagne-gold surfaces; the black/charcoal/gold dark theme is retained.
- Select a country, state/province and city before updating prayer times.
