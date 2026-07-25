# PitchForm

PitchForm is a local-first soccer strength and conditioning PWA built with React, Vite, and TypeScript.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production files are generated in `dist/`.

## Cloudflare Pages

Create a Cloudflare Pages project with these settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

After deployment, open the site in Safari on iPhone, tap Share, then Add to Home Screen.

## Data

All workout logs and activity entries are stored in the browser with `localStorage`. Use one device at a time for the MVP.
