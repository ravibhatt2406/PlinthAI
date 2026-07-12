# Plinth

**From empty plot to buildable plan — reasoned, not guessed.**

Plinth is an AI-assisted early-stage house planning tool. Enter a plot's
dimensions, orientation, and requirements, and Plinth generates a real,
rule-based 2D floor plan, extrudes it into an interactive 3D model, runs a
genuine astronomical sunlight simulation for the plot's actual coordinates,
and produces a cost breakdown grounded in a real construction-cost dataset —
all queryable through an AI advisor that only reasons over the data
generated for your specific plan.

Every number Plinth shows you either comes from a documented API, real
geometry math, or a sourced dataset. Nothing is hallucinated by the AI layer.

---

## What it does

1. **Plot Input** — length, width, north-facing direction, floors, budget,
   room requirements, style preference, and address (geocoded to real
   coordinates).
2. **2D Floor Plan** — a rule-based layout engine allocates rooms by
   standard adjacency logic and municipal setback rules; Gemini refines
   door/window placement and explains the reasoning in plain language.
3. **3D Model** — the exact same floor-plan data, extruded into an
   interactive Three.js model you can rotate, zoom, and re-skin (modern
   glass / traditional brick / minimal stucco).
4. **Sunlight Simulation** — real sun position data for the plot's actual
   coordinates and date drives an animated directional light and real cast
   shadows on the 3D model, plus a seasonal (summer vs. winter) comparison.
5. **Cost Estimate & Budget Optimizer** — a category-by-category cost
   breakdown against a sourced Indian construction-cost dataset; if you're
   over budget, it recalculates real trade-offs (swap materials, trim
   area) rather than guessing a number.
6. **AI Construction Advisor** — a chat interface grounded in your actual
   generated plan and estimate. It answers from that data or tells you it
   can't, rather than inventing figures.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| 3D rendering | React Three Fiber + drei (Three.js) |
| Backend / data | Supabase (Postgres) |
| AI reasoning | Gemini API (2.5 Flash / 2.5 Pro) |
| Maps | React Leaflet + OpenStreetMap tiles |
| Deployment | Vercel |

---

## Real data sources

Plinth deliberately avoids paid APIs and avoids faking data it doesn't
have. Every external data point comes from one of these:

| Source | Free? | Used for |
|---|---|---|
| [OpenStreetMap Nominatim](https://nominatim.org/) | Yes, no key | Geocoding plot address → lat/lng |
| [OpenStreetMap tiles](https://www.openstreetmap.org/) | Yes, no key | Map display in the location picker |
| [Sunrise-Sunset.org](https://sunrise-sunset.org/api) | Yes, no key | Real sunrise/sunset/solar noon for the plot's coordinates |
| [Open-Meteo](https://open-meteo.com/) | Yes, no key | Seasonal sun exposure, UV, temperature |
| [suncalc](https://github.com/mourner/suncalc) (npm) | Yes, MIT license | Sun azimuth/altitude math driving 3D shadow rendering |
| Gemini API | Free tier | Layout reasoning, cost-suggestion phrasing, advisor chat |
| Curated construction cost dataset | N/A (static, sourced) | Cost-per-unit figures (see `data/cost-dataset.json`) |

**Not included:** AR preview and resale/investment value prediction. No
genuine free API exists for either in a way that would hold up to
scrutiny, so they're left as roadmap items rather than faked.

---

## Getting started

```bash
git clone <repo-url>
cd plinth
npm install
```

Create a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

Run the Supabase schema in `supabase/schema.sql` against your project,
then:

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Project structure

```
app/
  plot/            # Step 1 — plot input form + map confirm
  plan/[id]/       # Steps 2–6 — floor plan, 3D, sunlight, cost, advisor
components/
  floor-plan/      # SVG 2D blueprint renderer
  scene-3d/        # React Three Fiber extrusion + lighting
  cost/            # Cost breakdown + budget optimizer UI
  advisor/         # Grounded chat interface
lib/
  layout-engine.ts # Rule-based room allocation + setback logic
  sun.ts           # suncalc wrapper, Sunrise-Sunset.org / Open-Meteo clients
  cost-engine.ts   # Cost calculation + optimizer diff logic
data/
  cost-dataset.json  # Sourced construction cost reference data
supabase/
  schema.sql
```

---

## Design principles

- **No invented numbers.** Cost figures come from a sourced dataset; sun
  data comes from real astronomical APIs; the AI layer reasons over that
  data, it doesn't generate it.
- **One geometry, two renderings.** The 2D floor plan and 3D model are
  generated from the same room-layout data structure — the 3D view is an
  extrusion, not a separately modeled asset.
- **Fail honestly.** If a feature can't be backed by real data (AR,
  resale value), it's left out rather than faked.

---

## Roadmap

- Ventilation/cross-airflow scoring from window/door geometry
- Construction timeline generator
- PDF export of the full plan
- AR preview (pending a viable free API)
- Resale/investment value estimation (pending a viable free data source)
