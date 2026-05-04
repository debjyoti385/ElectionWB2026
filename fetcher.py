#!/usr/bin/env python3
"""
West Bengal 2026 Election Data Fetcher
Fetches live data from ECI and writes to data/live_data.json every 5 minutes.
Usage: python3 fetcher.py
No external dependencies required (uses stdlib only).
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime

# ── Configuration ────────────────────────────────────────────────────────────
BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026"
LIVE_JSON_URL = f"{BASE_URL}/election-json-S25-live.json"
PARTYWISE_URL = f"{BASE_URL}/partywiseresult-S25.htm"
STATEWISE_URLS = [f"{BASE_URL}/statewiseS25{i}.htm" for i in range(1, 16)]
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "data", "live_data.json")
FETCH_INTERVAL = 180  # seconds (3 minutes)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://results.eci.gov.in/ResultAcGenMay2026/index.htm",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}

PARTY_COLORS = {
    "BJP":    "#f97316",
    "AITC":   "#3b82f6",
    "CPI(M)": "#dc2626",
    "AJUP":   "#7c3aed",
    "AISF":   "#059669",
    "INC":    "#0ea5e9",
    "BSP":    "#d97706",
    "IND":    "#6b7280",
}

PARTY_FULL_NAMES = {
    "BJP":    "Bharatiya Janata Party",
    "AITC":   "All India Trinamool Congress",
    "CPI(M)": "Communist Party of India (Marxist)",
    "INC":    "Indian National Congress",
    "AJUP":   "Aam Janata Unnayan Party",
    "AISF":   "All India Secular Front",
    "BSP":    "Bahujan Samaj Party",
    "IND":    "Independent",
}


# ── HTTP helper ───────────────────────────────────────────────────────────────
import gzip
import http.cookiejar
import ssl
import subprocess

# Shared cookie jar for session persistence
_cookie_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(_cookie_jar),
    urllib.request.HTTPSHandler(context=ssl.create_default_context()),
)
_use_curl = None   # None = auto-detect on first fetch


def fetch_url(url, timeout=25):
    """Fetch URL. Uses curl if urllib is blocked (403)."""
    global _use_curl

    # If we already know curl is needed, go straight there
    if _use_curl:
        return _fetch_via_curl(url, timeout)

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with _opener.open(req, timeout=timeout) as resp:
            raw = resp.read()
            encoding = resp.headers.get("Content-Encoding", "")
            if encoding == "gzip":
                raw = gzip.decompress(raw)
            _use_curl = False
            return raw.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 403:
            if _use_curl is None:
                log("  ECI requires curl mode — switching (this is normal)")
            _use_curl = True
            return _fetch_via_curl(url, timeout)
        raise


def _fetch_via_curl(url, timeout=25):
    """Use system curl as a fallback — better browser TLS fingerprint."""
    cmd = [
        "curl", "-s", "--max-time", str(timeout),
        "-A", HEADERS["User-Agent"],
        "-H", f"Accept: {HEADERS['Accept']}",
        "-H", f"Accept-Language: {HEADERS['Accept-Language']}",
        "-H", f"Referer: {HEADERS['Referer']}",
        "-H", "Cache-Control: no-cache",
        "--compressed",          # handle gzip automatically
        "--cookie-jar", "/tmp/eci_cookies.txt",
        "--cookie", "/tmp/eci_cookies.txt",
        "-L",                    # follow redirects
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=timeout + 5)
    if result.returncode != 0:
        raise RuntimeError(f"curl failed (exit {result.returncode}): {result.stderr.decode()[:200]}")
    text = result.stdout.decode("utf-8", errors="replace")
    if not text.strip():
        raise RuntimeError("curl returned empty response")
    return text


# ── Parser: live JSON ─────────────────────────────────────────────────────────
def parse_live_json(text):
    """Return dict {ac_no_str: {party, candidate, color}}"""
    try:
        data = json.loads(text)
        chart = data.get("S25", {}).get("chartData", [])
    except Exception:
        return {}
    result = {}
    for entry in chart:
        if len(entry) >= 5:
            party, _, ac_no, cand, color = entry[0], entry[1], entry[2], entry[3], entry[4]
            result[str(ac_no)] = {"party": party, "candidate": cand, "color": color}
    return result


# ── Parser: party-wise totals ─────────────────────────────────────────────────
def parse_partywise(html):
    """Return dict {abbr: {fullName, won, leading, total, votes, votePct, color}}"""
    # ── Seat counts from table ────────────────────────────────────────────────
    pattern = (
        r'<td[^>]*style="text-align:left">(.*?)</td>\s*'
        r'<td[^>]*style="text-align:right">\s*(\d+)\s*</td>\s*'
        r'<td[^>]*style="text-align:right">\s*(?:<a[^>]*>)?(\d+)(?:</a>)?\s*</td>\s*'
        r'<td[^>]*style="text-align:right">(\d+)</td>'
    )
    rows = re.findall(pattern, html, re.DOTALL)
    result = {}
    for row in rows:
        name = re.sub(r"\s+", " ", row[0]).strip()
        abbr_m = re.search(r" - ([A-Z\(\)]+)$", name)
        abbr = abbr_m.group(1) if abbr_m else name[:6].strip()
        full_name = re.sub(r" - [A-Z\(\)]+$", "", name).strip()
        result[abbr] = {
            "fullName": full_name,
            "won": int(row[1]),
            "leading": int(row[2]),
            "total": int(row[3]),
            "votes": 0,
            "votePct": 0.0,
            "color": PARTY_COLORS.get(abbr, "#9ca3af"),
        }

    # ── Vote share from embedded JS (second xValues / yValues block) ─────────
    x_matches = re.findall(r"xValues\s*=\s*\[(.*?)\]", html, re.DOTALL)
    y_matches = re.findall(r"yValues\s*=\s*\[(.*?)\]", html, re.DOTALL)
    if len(x_matches) >= 2 and len(y_matches) >= 2:
        labels = re.findall(r"'([^']+)'", x_matches[1])
        votes  = [int(v) for v in re.findall(r"\d+", y_matches[1])]
        total_votes = sum(votes)
        vote_share = {}
        for lbl, v in zip(labels, votes):
            pct_m = re.search(r"\{([\d.]+)%\}", lbl)
            abbr = re.sub(r"\{.*\}", "", lbl).strip()
            pct = float(pct_m.group(1)) if pct_m else round(v / total_votes * 100, 2)
            vote_share[abbr] = {"votes": v, "votePct": pct}

        # Merge vote share into seat result; add small parties not in seat table
        for abbr, vs in vote_share.items():
            if abbr in result:
                result[abbr]["votes"]   = vs["votes"]
                result[abbr]["votePct"] = vs["votePct"]
            elif vs["votes"] > 0:
                result[abbr] = {
                    "fullName": abbr, "won": 0, "leading": 0, "total": 0,
                    "votes": vs["votes"], "votePct": vs["votePct"],
                    "color": PARTY_COLORS.get(abbr, "#9ca3af"),
                }
        # Store total votes at a special key
        result["__totalVotes__"] = total_votes

    return result


# ── Parser: statewise pages ───────────────────────────────────────────────────
def parse_statewise(html):
    """Return list of constituency dicts from one statewise page."""
    results = []
    tbody_m = re.search(r"<tbody>\s*(.*)", html, re.DOTALL)
    if not tbody_m:
        return results
    tbody = tbody_m.group(1)

    blocks = re.split(
        r"(?=<tr><td align=['\"]left['\"]>[A-Z][A-Z\s\(\)\/\-]+</td>"
        r"<td align=['\"]right['\"]>\d+</td>)",
        tbody,
    )

    for block in blocks:
        if not block.strip() or not block.startswith("<tr>"):
            continue
        header_m = re.match(
            r"<tr><td align=['\"]left['\"]>(.*?)</td>"
            r"<td align=['\"]right['\"]>(\d+)</td>",
            block,
        )
        if not header_m:
            continue

        ac_name = header_m.group(1).strip()
        ac_no = int(header_m.group(2))
        rest = block[header_m.end():]

        # Leading candidate
        lead_cand_m = re.match(r"<td align=['\"]left['\"]>(.*?)</td>", rest)
        lead_cand = lead_cand_m.group(1).strip() if lead_cand_m else ""
        if lead_cand_m:
            rest = rest[lead_cand_m.end():]

        # Parties (both leading and trailing) from nested tables
        # Broader pattern: match any <td> with party-like text (title case, no HTML)
        party_names = re.findall(
            r"<td[^>]*align=['\"]left['\"][^>]*>\s*([A-Z][A-Za-z\s\(\)]+?)\s*</td>",
            rest,
        )
        # Filter: keep only real party names — exclude status strings, all-caps, short text
        _EXCLUDE = {"Result in Progress", "Result Declared", "Not Started",
                    "Counting not started", "Party Wise State Trends",
                    "Leading In", "Won In", "Trailing In"}
        party_names = [
            p for p in party_names
            if len(p) > 5 and not p.isupper() and p not in _EXCLUDE
               and not p.startswith("Result") and not p.startswith("Not ")
               and not p.startswith("Counting")
        ]
        lead_party = party_names[0].strip() if len(party_names) > 0 else ""
        trail_party = party_names[1].strip() if len(party_names) > 1 else ""

        # Trailing candidate (after first nested table ends)
        nested_end = rest.find("</table></td>")
        rest2 = rest[nested_end + 13:] if nested_end >= 0 else rest
        trail_cand_m = re.match(r"\s*<td[^>]*>(.*?)</td>", rest2)
        trail_cand = trail_cand_m.group(1).strip() if trail_cand_m else ""

        # Margin, round, status — search from AFTER the two nested party tables
        # so we never accidentally land in the page footer for the last row
        second_nested_end = block.find("</table></td>", block.find("</table></td>") + 1)
        search_zone = block[second_nested_end:second_nested_end + 600] if second_nested_end >= 0 else block[-800:]
        tail_m = re.search(
            r"<td align=['\"]right['\"]>([\d\-]+)</td>\s*"
            r"<td align=['\"]right['\"]>([\d/\-]+)</td>\s*"
            r"<td align=['\"]left['\"]>(Result[^<]*|Not Started[^<]*|Counting[^<]*)</td>",
            search_zone,
        )
        if tail_m:
            raw_margin = tail_m.group(1).strip()
            margin = int(raw_margin) if raw_margin.lstrip("-").isdigit() and raw_margin != "-" else 0
            round_str = tail_m.group(2).strip() if tail_m.group(2) != "-" else ""
            status = tail_m.group(3).strip()
        else:
            margin, round_str, status = 0, "", ""

        results.append(
            {
                "ac": ac_no,
                "acName": ac_name,
                "leadCand": lead_cand,
                "leadParty": lead_party,
                "trailCand": trail_cand,
                "trailParty": trail_party,
                "margin": margin,
                "round": round_str,
                "status": status,
            }
        )

    return results


# ── Main fetch and merge ──────────────────────────────────────────────────────
def fetch_all():
    log("Fetching live JSON…")
    try:
        live_text = fetch_url(LIVE_JSON_URL)
        const_data = parse_live_json(live_text)
        log(f"  Live JSON: {len(const_data)} constituencies")
    except Exception as e:
        log(f"  Live JSON error: {e}")
        const_data = {}

    log("Fetching party totals…")
    try:
        pw_html = fetch_url(PARTYWISE_URL)
        party_totals = parse_partywise(pw_html)
        log(f"  Party totals: {len(party_totals)} parties")
    except Exception as e:
        log(f"  Party totals error: {e}")
        party_totals = {}

    log("Fetching statewise pages…")
    statewise_data = {}
    for i, url in enumerate(STATEWISE_URLS, 1):
        try:
            html = fetch_url(url)
            rows = parse_statewise(html)
            for r in rows:
                statewise_data[str(r["ac"])] = r
        except Exception as e:
            log(f"  Statewise page {i} error: {e}")
    log(f"  Statewise: {len(statewise_data)} constituencies")

    # Merge
    for ac_str, sw in statewise_data.items():
        if ac_str in const_data:
            const_data[ac_str].update(
                {
                    "acName": sw["acName"],
                    "leadCand": sw["leadCand"],
                    "leadParty": sw["leadParty"],
                    "trailCand": sw["trailCand"],
                    "trailParty": sw["trailParty"],
                    "margin": sw["margin"],
                    "round": sw["round"],
                    "status": sw["status"],
                }
            )
        else:
            const_data[ac_str] = {
                "party": _guess_abbr(sw["leadParty"]),
                "candidate": sw["leadCand"],
                "color": "#9ca3af",
                "acName": sw["acName"],
                "leadCand": sw["leadCand"],
                "leadParty": sw["leadParty"],
                "trailCand": sw["trailCand"],
                "trailParty": sw["trailParty"],
                "margin": sw["margin"],
                "round": sw["round"],
                "status": sw["status"],
            }

    # ── Rebuild seat counts from constituencies (more reliable than partywise HTML) ──
    # Reset seat counters so we don't double-count
    for abbr in party_totals:
        if isinstance(party_totals[abbr], dict):
            party_totals[abbr]["won"]     = 0
            party_totals[abbr]["leading"] = 0
            party_totals[abbr]["total"]   = 0

    for ac_str, c in const_data.items():
        abbr = c.get("party", "")
        if not abbr or abbr == "NA":
            continue
        status = c.get("status", "")
        is_won = "declared" in status.lower()

        if abbr not in party_totals:
            party_totals[abbr] = {
                "fullName": PARTY_FULL_NAMES.get(abbr, abbr),
                "won": 0, "leading": 0, "total": 0,
                "votes": 0, "votePct": 0.0,
                "color": PARTY_COLORS.get(abbr, "#9ca3af"),
            }
        if is_won:
            party_totals[abbr]["won"] += 1
        else:
            party_totals[abbr]["leading"] += 1
        party_totals[abbr]["total"] += 1

    # Guard: don't overwrite good data with empty results
    if len(const_data) == 0 and len(statewise_data) == 0:
        log("  ⚠ No data fetched — keeping existing live_data.json unchanged")
        return None

    reporting = sum(
        1
        for v in const_data.values()
        if v.get("status") and v["status"] not in ("Not Started", "Counting not started", "")
    )

    output = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "totalSeats": 294,
        "totalReporting": reporting,
        "partyTotals": party_totals,
        "constituencies": const_data,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    # Write atomically via temp file to avoid partial reads
    tmp_file = OUTPUT_FILE + ".tmp"
    with open(tmp_file, "w") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp_file, OUTPUT_FILE)

    log(f"Saved → {OUTPUT_FILE}  ({reporting}/294 reporting)")
    return output


def _guess_abbr(full_name):
    for abbr, full in PARTY_FULL_NAMES.items():
        if abbr.lower() in full_name.lower() or full.lower() in full_name.lower():
            return abbr
    return "OTH"


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def _load_env():
    """Load key=value pairs from .env file next to this script (if present)."""
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    env = {}
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    return env


def git_push():
    """Commit updated live_data.json and push to remote (for GitHub Pages).

    Reads GITHUB_PAT and GITHUB_REMOTE from .env (never stored in the repo).
    Falls back to the existing git remote if .env is not present.
    """
    import subprocess
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.relpath(OUTPUT_FILE, repo_dir)

    # Remove any stale git lock files that block commits/pushes
    for lock in ("HEAD.lock", "index.lock"):
        lock_path = os.path.join(repo_dir, ".git", lock)
        try:
            if os.path.exists(lock_path):
                os.remove(lock_path)
                log(f"  Removed stale {lock}")
        except OSError:
            pass
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Build authenticated remote URL from .env if available
    env = _load_env()
    pat    = env.get("GITHUB_PAT") or os.environ.get("GITHUB_PAT")
    remote = env.get("GITHUB_REMOTE") or os.environ.get("GITHUB_REMOTE")

    push_url = None
    if pat and remote:
        # Inject PAT into URL: https://<user>:<pat>@github.com/...
        # Works with both https://github.com/... and git@github.com:... forms
        if remote.startswith("https://"):
            # Strip any existing credentials first
            bare = re.sub(r"https://[^@]*@", "https://", remote)
            host_path = bare[len("https://"):]
            push_url = f"https://debjyoti385:{pat}@{host_path}"
        else:
            log("  git: GITHUB_REMOTE must be an https:// URL for PAT auth")
    else:
        if not pat:
            log("  git: GITHUB_PAT not found in .env — using existing remote credentials")

    cmds = [
        ["git", "-C", repo_dir, "add", data_file],
        ["git", "-C", repo_dir, "commit", "-m", f"results: auto-update {ts}"],
        (["git", "-C", repo_dir, "push", push_url, "main"] if push_url
         else ["git", "-C", repo_dir, "push"]),
    ]
    for cmd in cmds:
        # Never log the push URL — it contains the PAT
        display = cmd.copy()
        if push_url and push_url in display:
            display[display.index(push_url)] = "<remote>"
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            if "nothing to commit" in result.stdout + result.stderr:
                log("  git: nothing new to commit")
                return
            log(f"  git error ({' '.join(display[2:])}): {result.stderr.strip()}")
            return
    log("  ✓ Pushed live_data.json to GitHub")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log("=== WB 2026 Election Fetcher started ===")
    log(f"Output: {OUTPUT_FILE}")
    log(f"Interval: {FETCH_INTERVAL}s")

    run_once = "--once" in sys.argv
    do_push  = "--push" in sys.argv

    if do_push:
        log("Git push mode enabled — will commit+push after each fetch")
    log("")

    while True:
        try:
            result = fetch_all()
            if do_push and result is not None:
                git_push()
        except Exception as e:
            log(f"ERROR in fetch_all: {e}")

        if run_once:
            break

        log(f"Sleeping {FETCH_INTERVAL}s until next fetch…")
        time.sleep(FETCH_INTERVAL)
