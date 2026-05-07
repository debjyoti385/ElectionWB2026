# West Bengal Assembly Election 2026 — Live Results

Interactive election results dashboard with map visualization, live vote analysis, and constituency-level data fetched directly from the Election Commission of India.

**Live site:** [https://www.debjyotipaul.in/ElectionWB2026/](https://www.debjyotipaul.in/ElectionWB2026/)

---

## Features

- 🗺️ **Interactive map** — All 294 constituencies colored by winning/leading party, with tooltips and click-to-inspect
- 📊 **Overview** — Seat tally cards, alliance battle bar, notable candidates tracker, biggest leads and closest contests
- 🗳️ **Vote analysis** — FPTP distortion chart (vote share vs seat share), full party-wise vote breakdown table
- 🔬 **Analytics** — Margin distribution histogram, closest races, wafer-thin seat highlights
- 🏙️ **Districts** — Interactive district selector with constituency-by-constituency breakdown for all 23 WB districts
- 📋 **All Seats** — Sortable, filterable table with search across constituency, candidate, party, and district
- ⚡ Auto-refreshes every 3 minutes from ECI; live badge shows data freshness

---

## Keeping data live

The fetcher scrapes [results.eci.gov.in](https://results.eci.gov.in/ResultAcGenMay2026/) and pushes updated results to GitHub every 3 minutes. It must run **on your local machine** — the ECI's Akamai CDN blocks cloud/datacenter IPs.

```bash
# Start the fetcher (runs continuously, auto-pushes to GitHub)
bash run.sh
```

The fetcher writes `data/live_data.json` on each successful fetch, commits it, and pushes to the repo. The live site picks up the new file automatically on the next page refresh.

---

## Local preview

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

---

## File structure

```
├── index.html              — Main dashboard (6 tabs)
├── fetcher.py              — ECI scraper (Python stdlib only, no pip needed)
├── run.sh                  — One-liner: fetch continuously + auto-push
├── .nojekyll               — Disables Jekyll on GitHub Pages
├── css/
│   └── style.css           — Dual light/dark theme, all component styles
├── js/
│   ├── app.js              — Main controller, all render functions
│   ├── charts.js           — Chart.js renderers (donut, bar, histogram)
│   ├── map.js              — Leaflet map (full + overview mini-map)
│   ├── table.js            — All Seats results table with filtering
│   ├── ac_district_map.js  — Authoritative AC→district mapping (294 constituencies)
│   └── seed_data.js        — Seed data shown before live JSON loads
└── data/
    ├── live_data.json      — Written by fetcher.py every 3 min
    └── wb_map.json         — GeoJSON boundaries for all 294 constituencies
```

---

## Data source

All results are fetched from the **[Election Commission of India](https://results.eci.gov.in/ResultAcGenMay2026/)** official portal. No third-party APIs or paid services are used. This is an unofficial visualization — always refer to the ECI portal for authoritative results.
