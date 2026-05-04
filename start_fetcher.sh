#!/bin/bash
# ── WB 2026 Election Data Fetcher Launcher ────────────────────────────────────
# Usage:
#   ./start_fetcher.sh          # run continuously (every 5 min)
#   ./start_fetcher.sh --once   # fetch once and exit
#
# The fetcher writes to data/live_data.json which the website reads automatically.

cd "$(dirname "$0")"

echo "============================================"
echo " West Bengal 2026 Election Data Fetcher"
echo "============================================"
echo " Data folder : $(pwd)/data/"
echo " Output file : $(pwd)/data/live_data.json"
echo " Interval    : 300 seconds (5 minutes)"
echo "============================================"
echo ""

python3 fetcher.py "$@"
