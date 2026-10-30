"""Convert an events CSV into data/events.js for the Triangle Reads site.

Usage (from the site folder):
    python tools/build_events.py path/to/events.csv [more.csv ...]

CSV columns: date,start,end,title,host,location,url,notes
Optional columns: end_date (last day of a multi-day event) and description.
Optional extra columns: type (semicolon-separated), space, city
override the automatic guesses.

To pull events from the Triangle Reads Google Calendar, run
tools/import_gcal.py first to turn the calendar export into a CSV.

Venue and town info comes from triangle_libraries_bookstores.csv and
triangle_municipalities.csv in the same data/ folder as this script's parent.
"""
import csv
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
DATA = SITE / "data"

TYPES = ["Author Event", "Book Club", "For Kids", "Poetry", "Writing", "Talk & Discussion", "Sale & Fair", "Special Event"]

# Ordered keyword rules: (type, regex on title)
RULES = [
    ("For Kids", r"storytime|story time|\bkids?\b|children|young readers|teen|\bya\b(?! for adults)"),
    ("Book Club", r"book club|qlub|reading group"),
    ("Poetry", r"poet|poem|slam"),
    ("Writing", r"workshop|writer'?s|writing"),
    ("Talk & Discussion", r"humanities|conversation|discussion|panel|lecture|talk\b"),
    ("Sale & Fair", r"\bsale\b|book fair"),
    ("Special Event", r"\btea\b|kickoff|party|festival|celebration"),
    ("Author Event", r"signing|\bauthors?\b|showcase"),
]

# Hand classifications where the title alone doesn't say enough.
OVERRIDES = {
    "Max Brallier": ["Author Event", "For Kids"],
    "Matt Tavares": ["Author Event", "For Kids", "Special Event"],
    "Linda Ashman": ["Author Event", "For Kids"],
    "Local Author Book Fair": ["Author Event", "Sale & Fair"],
    "Talk Smutty to Me": ["Book Club"],
    "Blood and Politics": ["Author Event", "Talk & Discussion"],
    "Mahalia Jackson": ["Author Event", "Talk & Discussion"],
    "Second Sunday Poetry": ["Poetry", "Author Event"],
    "Barbara Kingsolver": ["Author Event"],
}


def load_venues():
    venues = {}
    with open(DATA / "triangle_libraries_bookstores.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            venues[r["name"].lower()] = r
    return venues


def load_towns():
    towns = {}
    with open(DATA / "triangle_municipalities.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            towns[r["municipality"].lower()] = r["county"]
    return towns


def find_venue(host, venues):
    h = host.lower()
    if h in venues:
        return venues[h]
    for name, r in venues.items():
        if h in name or name in h:
            return r
    for r in venues.values():
        system = r["system_or_owner"].lower()
        if system and (h in system or system in h):
            return r
    return None


def classify(title):
    for key, types in OVERRIDES.items():
        if key.lower() in title.lower():
            return types
    t = title.lower()
    found = [typ for typ, rx in RULES if re.search(rx, t)]
    # "Author Name: Book Title" is the usual shape of an author event
    if not found and ":" in title:
        found = ["Author Event"]
    return found or ["Special Event"]


def guess_city(location, venue, towns):
    if re.match(r"^(online|virtual)\b", location.strip(), re.I):
        return "Online"
    for part in reversed([p.strip() for p in location.split(",")]):
        if part.lower() in towns:
            return part
    return venue["town"] if venue else ""


def guess_space(location, venue):
    loc = location.lower()
    if "library" in loc:
        return "Library"
    if venue is None:
        return "Other Venue"
    # At the host's own address: the location starts with a street number
    # or with the venue's own name.
    name = re.sub(r"^the\s+|\s*\(.*\)$", "", venue["name"].lower())
    if re.match(r"^\d", location) or re.sub(r"^the\s+", "", loc).startswith(name) or venue["category"] == "Library":
        return venue["category"]
    return "Other Venue"


def main(paths):
    venues, towns = load_venues(), load_towns()
    events = []
    for p in paths:
        with open(p, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                venue = find_venue(r["host"], venues)
                types = [t.strip() for t in r.get("type", "").split(";") if t.strip()] or classify(r["title"])
                city = r.get("city") or guess_city(r["location"], venue, towns)
                events.append({
                    "id": f"{r['date']}-{len(events)}",
                    "date": r["date"],
                    "start": r["start"],
                    "end": r["end"],
                    "title": r["title"].strip(),
                    "endDate": (r.get("end_date") or "").strip(),
                    "host": venue["name"] if venue else r["host"].strip(),
                    "hostType": venue["category"] if venue else "",
                    "location": r["location"].strip(),
                    "city": city,
                    "county": towns.get(city.lower(), ""),
                    "space": r.get("space") or guess_space(r["location"], venue),
                    "types": types,
                    "url": r["url"].strip(),
                    "notes": r["notes"].strip(),
                    "description": (r.get("description") or "").strip(),
                })
    events.sort(key=lambda e: (e["date"], e["start"]))
    out = DATA / "events.js"
    body = json.dumps(events, indent=1, ensure_ascii=False)
    places = [
        {
            "name": v["name"], "category": v["category"], "kind": v["kind"],
            "system": v["system_or_owner"], "town": v["town"], "county": v["county"],
            "address": v["address"], "website": v["website"], "notes": v["notes"],
        }
        for v in venues.values()
    ]
    out.write_text(
        "// Generated by tools/build_events.py. Do not edit by hand.\n"
        f"window.TR_TYPES = {json.dumps(TYPES)};\n"
        f"window.TR_VENUES = {json.dumps(places, indent=1, ensure_ascii=False)};\n"
        f"window.TR_EVENTS = {body};\n",
        encoding="utf-8",
    )
    (DATA / "events.json").write_text(body, encoding="utf-8")
    print(f"Wrote {len(events)} events to {out}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
