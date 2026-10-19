#!/usr/bin/env python3
"""Explicit companion schema upgrade. Default is read-only; never prints tokens."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

PROJECT = "wehyamqphrvizksxhpzn"
ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        print("Missing SUPABASE_ACCESS_TOKEN; configure it securely, never in chat.")
        return 2

    def query(sql):
        request = urllib.request.Request(
            f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
            data=json.dumps({"query": sql}).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)

    try:
        installed = query("select to_regclass('public.trip_bookings') is not null installed")[0]["installed"]
        if installed:
            print("Companion schema already installed; no migration reapplied.")
        elif args.apply:
            query((ROOT / "supabase/migrations/202610190001_trip_companion.sql").read_text())
            print("Companion migration applied. Existing bookings and finances were not rewritten.")
        else:
            print("Companion schema pending. Use --apply only with administrative authorization.")
        return 0
    except urllib.error.HTTPError as error:
        print(f"Supabase administrative request failed: HTTP {error.code}. No mutation was confirmed.")
        return 1
    except urllib.error.URLError:
        print("Supabase administrative request failed: network error. No mutation was confirmed.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
