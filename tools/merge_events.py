"""Merge several event CSVs into one, dropping duplicates.

Usage (from the site folder):
    python tools/merge_events.py data/events_all.csv data/events_calendar.csv data/scraped/*.csv

Two rows are the same event when they share a date, start time and host and
their titles start the same way. The first file listed wins, so put the
Google Calendar export first.
"""
import csv
import re
import sys

FIELDS = ["date", "end_date", "start", "end", "title", "host", "location", "url", "notes", "description"]


def key(r):
    host = re.sub(r"^the\s+", "", r["host"].lower())[:10]
    title = re.sub(r"[^a-z0-9]", "", r["title"].lower())[:14]
    return (r["date"], r["start"], host, title)


def main(out, paths):
    seen, rows = set(), []
    for p in paths:
        with open(p, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                r = {k: (r.get(k) or "").strip() for k in FIELDS}
                if not r["date"] or key(r) in seen:
                    continue
                seen.add(key(r))
                rows.append(r)
    rows.sort(key=lambda r: (r["date"], r["start"]))
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} events to {out}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])
