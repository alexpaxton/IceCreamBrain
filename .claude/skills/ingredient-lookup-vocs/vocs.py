#!/usr/bin/env python3
"""
vocs.py — VOC reference data tool

Usage:
  vocs.py lookup ingredient <query>
  vocs.py lookup compound <query>
  vocs.py lookup compounds <name-or-id> [name-or-id ...]

  vocs.py insert compound '<json>'
  vocs.py insert ingredient '<json>'
  vocs.py insert compounds '<json-array>'
  vocs.py insert ingredients '<json-array>'

  vocs.py pubchem '<json-array>'

  vocs.py flavordb <ingredient-name>
  vocs.py flavordb <entity_id>

lookup ingredient/compound
  Exits 0 with JSON if found, 1 if not found.
  Searches by id, name, alias, then partial match.

lookup compounds
  Always exits 0. Prints {"found": {query: entry, ...}, "missing": [query, ...]}.
  Useful for splitting a large FlavorDB molecule list into cached vs. new.

insert compound/ingredient
  Accepts a single JSON object. Exits 0 on success, 1 if id already exists.

insert compounds/ingredients
  Accepts a JSON array (or single object). Skips existing ids.
  Exits 0 and prints "Inserted N, skipped M."

pubchem
  Input: JSON array of objects. Each must have at least {"name": "...", "pubchem_cid": N}.
  Optional FlavorDB fields: "odor", "taste", "fat_logp" (also accepts "xlogp", "pubchem_id",
  "common_name" as aliases for the canonical field names).
  Fetches solubility and boiling point from PubChem for each CID and outputs a JSON array
  of compound entries ready for `vocs.py insert compounds`.
  Note: auto-parsed values should be reviewed — the LLM should correct any misinterpretations
  before inserting.

flavordb
  If argument is a name: searches FlavorDB for the ingredient.
    - Single match: auto-fetches entity and prints {"status": "found", "entity": {...}, "molecules": [...]}.
    - Multiple matches: prints {"status": "multiple", "matches": [...]}.
    - No matches: prints {"status": "not_found"}.
  If argument is numeric: fetches that entity_id directly (use after user picks from "multiple").
  "molecules" output is pre-shaped for `vocs.py pubchem` input.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent.parent / "flavor-explorer" / "src" / "data"
INGREDIENTS_FILE = DATA_DIR / "ingredients.json"
COMPOUNDS_FILE = DATA_DIR / "compounds.json"

PUBCHEM_DELAY = 0.2  # seconds between requests


# ── shared helpers ─────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    return s.lower().strip()


def to_compound_id(name: str) -> str:
    """Derive a kebab-case id from a compound display name."""
    s = name
    for greek, latin in [("α", "alpha"), ("β", "beta"), ("γ", "gamma"), ("δ", "delta"), ("ε", "epsilon")]:
        s = s.replace(greek, latin)
    # (Z)-, (E)-, (R)-, (S)- → keep as letter prefix
    s = re.sub(r"^\(([ZERSzers])\)-\s*", lambda m: m.group(1).lower() + "-", s)
    # (+)-, (-)-, (±)- → drop
    s = re.sub(r"^\([±+\-]+\)-\s*", "", s)
    # Drop remaining parenthetical content
    s = re.sub(r"\([^)]*\)", "", s)
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


_TEMP_PATTERN = re.compile(
    # Matches: number + °C or °F, optionally followed by (number °F/C) — the
    # paired form.  The optional group lets us detect already-expanded values
    # in a single pass so newly-inserted text is never re-scanned.
    r"(\d+(?:\.\d+)?)\s*°([CF])(?:\s*\(\s*(\d+(?:\.\d+)?)\s*°([CF])\s*\))?"
)


def add_both_temp_units(value: str) -> str:
    """Ensure every temperature in `value` appears in both °C and °F.

    Processes the string in a single left-to-right pass.  Already-paired values
    like "25°C (77°F)" are kept unchanged; lone temperatures get the missing
    unit appended.
    """
    parts: list[str] = []
    last = 0
    for m in _TEMP_PATTERN.finditer(value):
        parts.append(value[last:m.start()])
        num, unit, paired_num = m.group(1), m.group(2), m.group(3)
        if paired_num is not None:
            # Already paired — keep verbatim
            parts.append(m.group(0))
        elif unit == "C":
            c = float(num)
            parts.append(f"{num}°C ({c * 9/5 + 32:.1f}°F)")
        else:
            f = float(num)
            parts.append(f"{num}°F ({(f - 32) * 5/9:.1f}°C)")
        last = m.end()
    parts.append(value[last:])
    return "".join(parts)


def _search_collection(collection: dict, query: str) -> dict | None:
    q = normalize(query)
    for key, entry in collection.items():
        if normalize(key) == q:
            return entry
    for entry in collection.values():
        if normalize(entry.get("name", "")) == q:
            return entry
    for entry in collection.values():
        for alias in entry.get("aliases", []):
            if normalize(alias) == q:
                return entry
    for key, entry in collection.items():
        if q in normalize(key) or q in normalize(entry.get("name", "")):
            return entry
    return None


# ── lookup ─────────────────────────────────────────────────────────────────────

def cmd_lookup(args: list[str]) -> None:
    if len(args) < 2:
        print("Usage: vocs.py lookup (ingredient|compound|compounds) <query> [...]", file=sys.stderr)
        sys.exit(2)

    kind, *queries = args

    if kind == "ingredient":
        data = json.loads(INGREDIENTS_FILE.read_text())
        result = _search_collection(data["ingredients"], queries[0])
        if result is None:
            sys.exit(1)
        print(json.dumps(result, indent=2))

    elif kind == "compound":
        data = json.loads(COMPOUNDS_FILE.read_text())
        result = _search_collection(data["compounds"], queries[0])
        if result is None:
            sys.exit(1)
        print(json.dumps(result, indent=2))

    elif kind == "compounds":
        data = json.loads(COMPOUNDS_FILE.read_text())
        compounds = data["compounds"]
        found: dict = {}
        missing: list = []
        for q in queries:
            result = _search_collection(compounds, q)
            if result is not None:
                found[q] = result
            else:
                missing.append(q)
        print(json.dumps({"found": found, "missing": missing}, indent=2))

    else:
        print(f"Unknown lookup kind: {kind!r}", file=sys.stderr)
        sys.exit(2)


# ── insert ─────────────────────────────────────────────────────────────────────

def _insert_batch(file: Path, collection_key: str, entries: list[dict]) -> None:
    data = json.loads(file.read_text())
    collection = data[collection_key]
    inserted = skipped = 0
    for entry in entries:
        entry_id = entry.get("id")
        if not entry_id:
            print(f"Skipping entry with no id: {entry!r}", file=sys.stderr)
            continue
        if entry_id in collection:
            skipped += 1
        else:
            collection[entry_id] = entry
            inserted += 1
    file.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Inserted {inserted}, skipped {skipped} (already exist) into {file.name}.")


def cmd_insert(args: list[str]) -> None:
    if len(args) < 2:
        print("Usage: vocs.py insert (compound|compounds|ingredient|ingredients) '<json>'", file=sys.stderr)
        sys.exit(2)

    kind, raw_json = args[0], args[1]

    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(2)

    entries = payload if isinstance(payload, list) else [payload]

    if kind in ("compound", "compounds"):
        _insert_batch(COMPOUNDS_FILE, "compounds", entries)
    elif kind in ("ingredient", "ingredients"):
        _insert_batch(INGREDIENTS_FILE, "ingredients", entries)
    else:
        print(f"Unknown insert kind: {kind!r}", file=sys.stderr)
        sys.exit(2)


# ── pubchem ────────────────────────────────────────────────────────────────────

def _fetch_json(url: str) -> dict | list | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        return None


def _extract_l3(data: dict | None, heading: str) -> list[str]:
    """Extract text values from a PubChem pug_view L3 section.

    PubChem pug_view JSON nests data three levels deep:
      Record > Section (L1) > Section (L2) > Section (L3) > Information > Value > StringWithMarkup
    The ?heading=X filter places the requested data at L3.
    """
    if not data:
        return []
    vals: list[str] = []
    for s in data.get("Record", {}).get("Section", []):
        for sub in s.get("Section", []):
            for sub2 in sub.get("Section", []):
                if sub2.get("TOCHeading") == heading:
                    for info in sub2.get("Information", []):
                        for v in info.get("Value", {}).get("StringWithMarkup", []):
                            txt = v.get("String", "").strip()
                            if txt:
                                vals.append(txt)
    return vals


def _pick_water(vals: list[str]) -> str:
    if not vals:
        return "—"
    # Explicit "In water, X mg/L at T" — most reliable
    for v in vals:
        if re.match(r"in water[,\s]", v, re.I) and re.search(r"\d", v):
            return add_both_temp_units(v)
    # Numeric mg/mL or g/L without mentioning another solvent
    for v in vals:
        if re.search(r"\d+\.?\d*\s*(?:mg/m[lL]|g/[lL])", v):
            if not re.search(r"alcohol|ethanol|ether|chloroform|benzene|acetone|oil", v, re.I):
                return add_both_temp_units(v)
    # Qualitative — water-specific
    for v in vals:
        vl = v.lower()
        if "insoluble in water" in vl:
            return "Insoluble"
        if "slightly soluble in water" in vl:
            return "Slightly soluble"
        if "very soluble in water" in vl or ("very soluble" in vl and "water" in vl):
            return "Very soluble"
        if "soluble in water" in vl:
            return "Soluble"
        if "miscible" in vl and not re.search(r"alcohol|ethanol|ether|oil|chloroform", vl):
            return "Miscible"
    return add_both_temp_units(vals[0])


def _pick_alcohol(vals: list[str]) -> str:
    for v in vals:
        vl = v.lower()
        if re.search(r"miscible.{0,20}\b(alcohol|ethanol)\b|\b(alcohol|ethanol)\b.{0,20}miscible", vl):
            return "Miscible"
        if re.search(r"\bvery soluble.{0,20}\b(alcohol|ethanol)\b|\b(alcohol|ethanol)\b.{0,20}very soluble", vl):
            return "Very soluble"
        if re.search(r"\bsoluble in.{0,20}\b(alcohol|ethanol)\b|\b(alcohol|ethanol)\b.{0,20}soluble", vl):
            return "Soluble"
        if re.search(r"insoluble.{0,20}\b(alcohol|ethanol)\b", vl):
            return "Insoluble"
        if re.search(r"in ethanol|in alcohol|\b(?:alcohol|ethanol)\b.{0,10}\d", vl):
            return add_both_temp_units(v)
    return "—"


def _parse_bp(vals: list[str]) -> tuple[float | None, str | None]:
    """Return (bp_celsius_or_None, display_string_or_None).

    bp_celsius is only set for confirmed atmospheric (760 mmHg) or unqualified BPs.
    Reduced-pressure BPs return bp_celsius=None so stability classification is skipped.
    """
    for v in vals:
        # Explicit 760 mmHg / atmospheric
        m = re.search(r"([\d.]+)\s*°C\.?\s*@?\s*760", v, re.I)
        if m:
            c = float(m.group(1))
            return c, f"BP {c:.1f}°C ({c * 9/5 + 32:.1f}°F)"
        m = re.search(r"([\d.]+)\s*°F\s*at\s*760", v, re.I)
        if m:
            f_val = float(m.group(1))
            c = (f_val - 32) * 5/9
            return c, f"BP {c:.1f}°C ({f_val:.1f}°F)"

    for v in vals:
        # No pressure qualifier at all → assume atmospheric
        if re.search(r"\bmm\s*Hg\b|mmHg\b|\btorr\b|\bkPa\b", v, re.I):
            continue
        m = re.search(r"([\d.]+)\s*°C\b", v)
        if m:
            c = float(m.group(1))
            return c, f"BP {c:.1f}°C ({c * 9/5 + 32:.1f}°F)"
        m = re.search(r"([\d.]+)\s*°F\b", v)
        if m:
            f_val = float(m.group(1))
            c = (f_val - 32) * 5/9
            return c, f"BP {c:.1f}°C ({f_val:.1f}°F)"

    # Reduced-pressure only — return raw value, no stability classification
    for v in vals:
        if re.search(r"\d+\.?\d*\s*°[CF]", v):
            return None, add_both_temp_units(v.strip()) + " (reduced pressure; atmospheric BP not established)"

    return None, None


def _bp_to_temp_notes(bp_c: float | None, bp_str: str | None) -> str:
    if bp_str is None:
        return "—"
    if bp_c is None:
        return bp_str
    if bp_c < 60:
        return f"{bp_str}; gas or extremely volatile at room temperature, lost immediately upon heating"
    if bp_c < 100:
        return f"{bp_str}; very volatile, significant loss at cooking temperatures"
    if bp_c < 150:
        return f"{bp_str}; volatile, significant loss during cooking"
    if bp_c < 200:
        return f"{bp_str}; moderately volatile, some loss above 80°C (176°F)"
    return f"{bp_str}; heat-stable through custard processing"


def _make_flavor_smell(odor: str | None, taste: str | None) -> str:
    parts = []
    for raw in (odor, taste):
        if raw:
            first = raw.split("@")[0].strip().rstrip(".")
            if first:
                parts.append(first)
    return "; ".join(parts) if parts else "—"


def _make_logp_str(val) -> str:
    if val is None:
        return "—"
    v = float(val)
    tag = " — strongly fat-soluble" if v > 2 else (" — prefers water" if v < 0 else "")
    return f"LogP {v:.2g}{tag}"


def cmd_pubchem(args: list[str]) -> None:
    if not args:
        print("Usage: vocs.py pubchem '<json-array>'", file=sys.stderr)
        sys.exit(2)

    try:
        items = json.loads(args[0])
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        sys.exit(2)

    if not isinstance(items, list):
        items = [items]

    results = []
    for item in items:
        cid = item.get("pubchem_cid") or item.get("pubchem_id")
        name = item.get("name") or item.get("common_name") or str(cid)
        odor = item.get("odor")
        taste = item.get("taste")
        fat_logp = item.get("fat_logp") if item.get("fat_logp") is not None else item.get("xlogp")

        sol_data = _fetch_json(
            f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=Solubility"
        )
        bp_data = _fetch_json(
            f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=Boiling+Point"
        )
        time.sleep(PUBCHEM_DELAY)

        sol_vals = _extract_l3(sol_data, "Solubility")
        bp_vals = _extract_l3(bp_data, "Boiling Point")

        bp_c, bp_str = _parse_bp(bp_vals)

        results.append({
            "id": to_compound_id(name),
            "name": name,
            "aliases": [],
            "pubchem_cid": int(cid) if cid else None,
            "flavor_smell": _make_flavor_smell(odor, taste),
            "solubility": {
                "water": _pick_water(sol_vals),
                "alcohol": _pick_alcohol(sol_vals),
                "fat_logp": _make_logp_str(fat_logp),
            },
            "temp_notes": _bp_to_temp_notes(bp_c, bp_str),
            "sources": [f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"],
        })

    print(json.dumps(results, indent=2))


# ── flavordb ───────────────────────────────────────────────────────────────────

def _flavordb_fetch_entity(entity_id: int) -> None:
    url = f"https://cosylab.iiitd.edu.in/flavordb2/entities_json?id={entity_id}"
    data = _fetch_json(url)
    if not data or not isinstance(data, dict):
        print(json.dumps({"status": "not_found"}))
        return
    entity = {
        "entity_id": entity_id,
        "name": data.get("entity_alias_readable", ""),
        "scientific_name": data.get("natural_source_name") or None,
        "flavordb_url": f"https://cosylab.iiitd.edu.in/flavordb2/entity_details?id={entity_id}",
    }
    molecules = []
    for m in data.get("molecules", []):
        molecules.append({
            "name": m.get("common_name", ""),
            "pubchem_cid": m.get("pubchem_id"),
            "odor": m.get("odor") or None,
            "taste": m.get("taste") or None,
            "fat_logp": m.get("xlogp"),
        })
    print(json.dumps({"status": "found", "entity": entity, "molecules": molecules}, indent=2))


def _fetch_flavordb_search(ingredient: str) -> list | None:
    """FlavorDB search endpoint returns a double-encoded JSON string."""
    encoded = urllib.parse.quote(ingredient)
    url = f"https://cosylab.iiitd.edu.in/flavordb2/entities?entity={encoded}&category="
    raw = _fetch_json(url)
    if raw is None:
        return None
    # API returns a JSON-encoded string whose value is a JSON array
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return None
    return raw if isinstance(raw, list) else None


def cmd_flavordb(args: list[str]) -> None:
    if not args:
        print("Usage: vocs.py flavordb <ingredient-name-or-entity-id>", file=sys.stderr)
        sys.exit(2)

    query = args[0]

    # Numeric argument → direct entity fetch (user already picked from a multiple-match result)
    if query.isdigit():
        _flavordb_fetch_entity(int(query))
        return

    results = _fetch_flavordb_search(query)

    if not results or len(results) == 0:
        print(json.dumps({"status": "not_found"}))
        return

    if len(results) == 1:
        _flavordb_fetch_entity(results[0]["entity_id"])
        return

    matches = [
        {
            "entity_id": m["entity_id"],
            "name": m.get("entity_alias_readable", ""),
            "category": m.get("category_readable", ""),
            "scientific_name": m.get("natural_source_name", ""),
        }
        for m in results
    ]
    print(json.dumps({"status": "multiple", "matches": matches}, indent=2))


# ── main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd == "lookup":
        cmd_lookup(args)
    elif cmd == "insert":
        cmd_insert(args)
    elif cmd == "pubchem":
        cmd_pubchem(args)
    elif cmd == "flavordb":
        cmd_flavordb(args)
    else:
        print(f"Unknown command: {cmd!r}\n{__doc__}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
