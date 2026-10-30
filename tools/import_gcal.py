"""Turn a Google Calendar events export (JSON) into an events CSV for build_events.py.

Usage (from the site folder):
    python tools/import_gcal.py calendar.json data/events_calendar.csv

The JSON is the Google Calendar API events list ({"events": [...]} or
{"items": [...]}). Event titles are expected to look like
"Title (Host, note)", and descriptions to end with "Source: <url>".
"""
import csv
import json
import re
import sys
from datetime import date, timedelta

FIELDS = ["date", "end_date", "start", "end", "title", "host", "location", "url", "notes", "description"]

# Sentences in descriptions that are notes for the editor, not readers.
EDITOR_NOTES = re.compile(r"(End time not listed[^.]*\.|The listing doesn't state[^.]*\.)\s*")


def split_title(summary):
    """'Title (Host at Venue, note)' -> ('Title', 'Host', ['note'])."""
    m = re.match(r"^(.*)\s+\(([^()]*)\)$", summary.strip())
    if not m:
        return summary.strip(), "", []
    title, inner = m.groups()
    parts = [p.strip() for p in inner.split(",")]
    host = re.split(r"\s+at\s+", parts[0])[0]
    return title, host, parts[1:]


def clean_location(loc):
    return re.sub(r",\s*NC(\s+\d{5})?\s*$", "", (loc or "").strip())


def convert(ev):
    title, host, notes = split_title(ev.get("summary", ""))
    desc = ev.get("description", "") or ""
    url = ""
    m = re.search(r"Source:\s*(\S+)", desc)
    if m:
        url = m.group(1)
        desc = desc[: m.start()]
    if EDITOR_NOTES.search(desc):
        notes.append("end time assumed")
    desc = EDITOR_NOTES.sub("", desc).strip()

    start, end = ev["start"], ev["end"]
    if "dateTime" in start:
        d = start["dateTime"][:10]
        end_d = end["dateTime"][:10]
        row = {"date": d, "end_date": end_d if end_d != d else "",
               "start": start["dateTime"][11:16], "end": end["dateTime"][11:16]}
    else:
        d = start["date"][:10]
        last = date.fromisoformat(end["date"][:10]) - timedelta(days=1)  # end date is exclusive
        row = {"date": d, "end_date": last.isoformat() if last.isoformat() != d else "", "start": "", "end": ""}
    row.update(title=title, host=host, location=clean_location(ev.get("location")),
               url=url or ev.get("htmlLink", ""), notes="; ".join(notes), description=desc)
    return row


def main(src, out):
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    events = data.get("events") or data.get("items") or []
    rows = [convert(e) for e in events if e.get("status") != "cancelled"]
    rows.sort(key=lambda r: (r["date"], r["start"]))
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} events to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
