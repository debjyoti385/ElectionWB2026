#!/bin/bash
cd "$(dirname "$0")" && python3 fetcher.py --push "$@"
