# Global Risk Watch — Web demo (Next.js)

**▶ Live: https://global-risk-watch.vercel.app**

The Next.js version of the demo, deployable to **Vercel**. Mirrors the Python
framework's concepts (data sources, pluggable risk model, AI provider) in the
browser.

## Local dev

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Works with **zero configuration**: loads the bundled demo dataset and uses the
offline (template) AI provider — no database, no API key.

## Features

- 🗺️ SVG world choropleth (`d3-geo` + `topojson-client`, no external tiles)
- 📥 Three data sources: bundled demo · CSV upload (client-side) · Postgres connection (`/api/query`)
- 🧩 Column mapping for arbitrary datasets; risk scores derived by `lib/riskModel.ts`
- 🎛️ What-if sandbox (inflation / external-debt sliders)
- 🧠 AI report: offline template (default, no key) or any OpenAI-compatible API (`/api/report`)

## Deploy to Vercel

```bash
cd web
npm i -g vercel        # or: npx vercel
vercel login
vercel --prod          # auto-detects Next.js
```

The demo needs **no environment variables**. The database panel requires a
Postgres reachable from Vercel (e.g. Neon / Supabase); connection strings and
API keys are used per-request and never stored.

## Structure

```
web/
├── app/
│   ├── page.tsx              # dashboard (client)
│   ├── layout.tsx, globals.css
│   └── api/
│       ├── report/route.ts   # OpenAI-compatible report
│       └── query/route.ts    # Postgres query (safe identifier quoting)
├── components/               # RiskMap, DataTable, ColumnMapping, MarkdownView
├── lib/                      # riskModel, schema, offlineReport, types
└── public/                   # world topojson, ccn3→cca3 lookup, demo data
```
