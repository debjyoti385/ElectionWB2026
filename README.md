# West Bengal Assembly Election 2026 — Live Results

Interactive election results dashboard with map visualization, vote analysis, and live data updates from the Election Commission of India.

**Live site:** `https://<your-username>.github.io/<repo-name>/`

---

## Features

- 🗺️ Interactive Leaflet map — 294 constituencies colored by winning party
- 📊 Seat share, vote share, FPTP distortion analysis
- 📐 Margin analytics, closest races, district breakdown
- 📋 Full sortable/filterable results table
- ⚡ Auto-refreshes every 5 minutes from ECI

---

## Hosting on GitHub Pages

### 1 — Create the repository

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### 2 — Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under *Source*, select **Deploy from a branch**
3. Branch: **main** · Folder: **/ (root)**
4. Click **Save**

Your site will be live at `https://<your-username>.github.io/<repo-name>/` within ~1 minute.

### 3 — Keep data live (run on your machine)

The fetcher must run **locally** — the ECI CDN blocks cloud/datacenter servers.

```bash
# One-liner: fetch every 5 min and auto-push to GitHub
bash run.sh
```

Or with more control:

```bash
# Fetch once and push
python3 fetcher.py --push --once

# Fetch continuously, push each time
python3 fetcher.py --push

# Fetch continuously without pushing (local preview only)
python3 fetcher.py
```

Every successful fetch commits `data/live_data.json` and pushes to GitHub.
GitHub Pages automatically serves the updated file — visitors see fresh data on their next page load or after the 5-minute auto-refresh.

---

## Local preview

```bash
# Python built-in server (no install needed)
python3 -m http.server 8000
# Open http://localhost:8000
```

---

## File structure

```
├── index.html          — Main dashboard (5 tabs)
├── run.sh              — One-liner launcher (fetch + push)
├── fetcher.py          — ECI data fetcher (stdlib only, no pip install)
├── .nojekyll           — Disables Jekyll processing on GitHub Pages
├── css/
│   └── style.css
├── js/
│   ├── app.js          — Main controller
│   ├── charts.js       — Chart.js renderers
│   ├── map.js          — Leaflet map
│   ├── table.js        — Results table
│   └── seed_data.js    — 294-constituency seed (shown before live data loads)
└── data/
    ├── live_data.json  — Written by fetcher.py every 5 min
    └── wb_map.json     — Simplified GeoJSON for all 294 constituencies
```

---

## Data source

All results data is fetched from **[results.eci.gov.in](https://results.eci.gov.in/ResultAcGenMay2026/)** — the official Election Commission of India portal. No third-party APIs or paid services are used.

> **Note:** The ECI portal uses Akamai CDN which blocks requests from cloud/datacenter IPs. The fetcher automatically uses `curl` as a fallback when needed. This is why the fetcher must run from your local machine.
