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

  vocs.py fetch-annotations <heading> [--max-pages N] [--dump-first-page]

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
  Checks pubchem_annotations/{solubility,boiling-point}.json first (see fetch-annotations)
  and only makes a live per-compound request for CIDs not covered by that cache.
  Self-throttles to PubChem's ~5 req/s limit. If a response's X-Throttling-Control
  header reports Yellow/Red — even on an otherwise-successful request — the command
  stops immediately rather than continuing to hammer a congested endpoint, printing
  whatever it already fetched and exiting 1. If PubChem returns ServerBusy while
  throttle status is all-Green, that's PubChem's separate temporary IP block, not
  congestion — retrying doesn't help either, so the same stop-and-report behavior
  applies.

fetch-annotations
  One-time bulk harvest of a PUG-View annotation heading (e.g. "Solubility",
  "Boiling Point") across all of PubChem via the paginated
  /rest/pug_view/annotations/heading endpoint, saved locally as
  pubchem_annotations/<heading-slug>.json ({cid: [text, ...]}). `pubchem` reads this
  cache first, so a completed harvest means future ingredient lookups rarely need
  live per-compound PubChem calls at all.
  This endpoint's response schema has not been live-verified against this parser —
  run with --dump-first-page first, inspect the raw JSON, and confirm it matches
  before trusting a full harvest. Same self-throttling/blocked-detection as `pubchem`.

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
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent.parent / "flavor-explorer" / "src" / "data"
INGREDIENTS_FILE = DATA_DIR / "ingredients.json"
COMPOUNDS_FILE = DATA_DIR / "compounds.json"

ANNOTATIONS_DIR = Path(__file__).parent / "pubchem_annotations"

PUBCHEM_MIN_INTERVAL = 5.0  # 1 req/5s, well under PubChem's documented 5 req/s cap


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
        print(f"[lookup] searching ingredients for {queries[0]!r}...", file=sys.stderr)
        data = json.loads(INGREDIENTS_FILE.read_text())
        result = _search_collection(data["ingredients"], queries[0])
        if result is None:
            print("[lookup] not found", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(result, indent=2))

    elif kind == "compound":
        print(f"[lookup] searching compounds for {queries[0]!r}...", file=sys.stderr)
        data = json.loads(COMPOUNDS_FILE.read_text())
        result = _search_collection(data["compounds"], queries[0])
        if result is None:
            print("[lookup] not found", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(result, indent=2))

    elif kind == "compounds":
        print(f"[lookup] checking {len(queries)} compound(s) against local cache...", file=sys.stderr)
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
        print(f"[lookup] {len(found)} found, {len(missing)} missing", file=sys.stderr)
        print(json.dumps({"found": found, "missing": missing}, indent=2))

    else:
        print(f"Unknown lookup kind: {kind!r}", file=sys.stderr)
        sys.exit(2)


# ── insert ─────────────────────────────────────────────────────────────────────

def _insert_batch(file: Path, collection_key: str, entries: list[dict]) -> None:
    print(f"[insert] writing {len(entries)} entry(s) into {file.name}...", file=sys.stderr)
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


class PubChemBlocked(RuntimeError):
    """Raised when PubChem keeps refusing requests for reasons a client can't fix by retrying.

    PubChem reports two independent things on every response: the rolling usage-window
    status (X-Throttling-Control header, Green/Yellow/Red) and whether the request
    actually succeeded. PubChem also enforces a separate temporary IP block for bursty
    clients — that shows a Fault body while the header still reports all-Green,
    because the block isn't part of the rolling window at all. Retrying doesn't help
    in that case, so callers should stop and surface this rather than loop.
    """


class PubChemCongested(RuntimeError):
    """Raised the moment X-Throttling-Control reports Yellow/Red, even on a successful request.

    Waiting for an actual failure before backing off risks tipping into PubChem's harder
    temporary IP block (see PubChemBlocked). So rather than sleeping and retrying, we stop
    as soon as the header shows rising congestion and let the caller report progress so far.
    """


_last_pubchem_request_at = 0.0


def _pubchem_throttle_wait() -> None:
    global _last_pubchem_request_at
    now = time.monotonic()
    wait = _last_pubchem_request_at + PUBCHEM_MIN_INTERVAL - now
    if wait > 0:
        time.sleep(wait)
    _last_pubchem_request_at = time.monotonic()


def _parse_throttle_header(header_value: str) -> dict[str, str]:
    """'Request Count status: Green (0%), Service status: Green (0%), ...' -> {'Request Count': 'Green', ...}"""
    out = {}
    for part in header_value.split(","):
        m = re.search(r"(.+?) status:\s*(Green|Yellow|Red)", part.strip(), re.I)
        if m:
            out[m.group(1).strip()] = m.group(2).capitalize()
    return out


def _pubchem_get(url: str, max_retries: int = 3) -> dict | list | None:
    """Fetch a PubChem PUG-REST/PUG-View URL with self-throttling and backoff.

    Raises PubChemBlocked (rather than retrying forever) when the throttle header
    reports all-Green but the request still fails — see PubChemBlocked docstring.
    """
    backoff = 1.0
    for attempt in range(max_retries + 1):
        _pubchem_throttle_wait()
        req = urllib.request.Request(url, headers={"User-Agent": "ice-cream-vocs-skill/1.0"})
        header_val = ""
        body = None
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                header_val = r.headers.get("X-Throttling-Control", "")
                body = json.loads(r.read())
        except urllib.error.HTTPError as e:
            # PubChem sends busy/blocked faults as HTTP 503 on some endpoints (raises
            # HTTPError) and as a 200-with-Fault-body JSON on others — normalize both.
            header_val = e.headers.get("X-Throttling-Control", "") if e.headers else ""
            try:
                body = json.loads(e.read())
            except Exception:
                body = {"Fault": {"Message": f"HTTP {e.code}: {e.reason}"}}
        except Exception as e:
            if attempt >= max_retries:
                raise
            print(f"  [pubchem] request error (attempt {attempt + 1}/{max_retries + 1}): {e}", file=sys.stderr)
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
            continue

        is_fault = isinstance(body, dict) and "Fault" in body
        fault_msg = body.get("Fault", {}).get("Message", "") if is_fault else ""
        is_busy = is_fault and ("busy" in fault_msg.lower() or "too many requests" in fault_msg.lower())

        if not is_busy:
            status = _parse_throttle_header(header_val)
            if status and any(v != "Green" for v in status.values()):
                raise PubChemCongested(
                    f"PubChem throttle status is {header_val!r} — stopping now instead of "
                    f"continuing to hammer a congested endpoint. Wait before retrying."
                )
            return body

        status = _parse_throttle_header(header_val)
        if status and all(v == "Green" for v in status.values()):
            raise PubChemBlocked(
                f"PubChem returned {fault_msg!r} while throttle status was all-Green "
                f"({header_val!r}) — this is PubChem's separate temporary IP block, "
                f"not rate congestion. Retrying will not help; wait and try again later."
            )

        if attempt >= max_retries:
            raise PubChemBlocked(
                f"PubChem still busy after {max_retries + 1} attempts (throttle status: {header_val!r})."
            )

        print(f"  [pubchem] throttled ({header_val or 'no header'}), retrying in {backoff:.1f}s "
              f"(attempt {attempt + 1}/{max_retries + 1})", file=sys.stderr)
        time.sleep(backoff)
        backoff = min(backoff * 2, 30)

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


def _load_annotation_cache(slug: str) -> dict[str, list[str]]:
    f = ANNOTATIONS_DIR / f"{slug}.json"
    if f.exists():
        return json.loads(f.read_text())
    return {}


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

    # Bulk-harvested local cache (see `fetch-annotations`) takes priority over live
    # per-compound calls — skips the network entirely for any CID already covered.
    sol_cache = _load_annotation_cache("solubility")
    bp_cache = _load_annotation_cache("boiling-point")

    total = len(items)

    def _cid_str(item: dict) -> str | None:
        cid = item.get("pubchem_cid") or item.get("pubchem_id")
        return str(cid) if cid else None

    # Precompute how many live requests this run actually needs (each compound
    # needs 0-2, depending on cache coverage) so we can report an ETA up front
    # and count it down as live requests are made.
    live_needed = sum(
        (0 if _cid_str(item) in sol_cache else 1) + (0 if _cid_str(item) in bp_cache else 1)
        for item in items
    )
    live_done = 0

    print(
        f"[pubchem] {total} compound(s) queued — {live_needed} live PubChem request(s) needed "
        f"({total * 2 - live_needed} served from local cache); ETA ~{live_needed * PUBCHEM_MIN_INTERVAL:.0f}s "
        f"at 1 request/{PUBCHEM_MIN_INTERVAL:.0f}s",
        file=sys.stderr,
    )

    results = []
    remaining = list(items)
    try:
        while remaining:
            idx = total - len(remaining) + 1
            item = remaining[0]
            cid = item.get("pubchem_cid") or item.get("pubchem_id")
            name = item.get("name") or item.get("common_name") or str(cid)
            odor = item.get("odor")
            taste = item.get("taste")
            fat_logp = item.get("fat_logp") if item.get("fat_logp") is not None else item.get("xlogp")
            cid_str = str(cid) if cid else None

            print(f"[pubchem] ({idx}/{total}) {name} (CID {cid})", file=sys.stderr)

            if cid_str and cid_str in sol_cache:
                sol_vals = sol_cache[cid_str]
                print("  [pubchem] solubility: cache hit", file=sys.stderr)
            else:
                print("  [pubchem] solubility: live request...", file=sys.stderr)
                sol_data = _pubchem_get(
                    f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=Solubility"
                )
                sol_vals = _extract_l3(sol_data, "Solubility")
                live_done += 1

            if cid_str and cid_str in bp_cache:
                bp_vals = bp_cache[cid_str]
                print("  [pubchem] boiling point: cache hit", file=sys.stderr)
            else:
                print("  [pubchem] boiling point: live request...", file=sys.stderr)
                bp_data = _pubchem_get(
                    f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/{cid}/JSON?heading=Boiling+Point"
                )
                bp_vals = _extract_l3(bp_data, "Boiling Point")
                live_done += 1

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
            remaining.pop(0)

            eta = (live_needed - live_done) * PUBCHEM_MIN_INTERVAL
            print(
                f"  [pubchem] ({idx}/{total}) done — {live_done}/{live_needed} live requests used, "
                f"ETA ~{eta:.0f}s remaining",
                file=sys.stderr,
            )
    except (PubChemBlocked, PubChemCongested) as e:
        print(json.dumps(results, indent=2))
        print(
            f"\nStopped after {len(results)}/{len(items)} compounds — {e}\n"
            f"{len(remaining)} compound(s) not yet fetched: "
            f"{[i.get('name') for i in remaining]}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(json.dumps(results, indent=2))


def cmd_fetch_annotations(args: list[str]) -> None:
    if not args:
        print(
            "Usage: vocs.py fetch-annotations <heading> [--max-pages N] [--dump-first-page]\n"
            "  heading: e.g. 'Solubility' or 'Boiling Point'\n"
            "  --dump-first-page: write the raw page-1 JSON to _raw_sample_<slug>.json for\n"
            "    schema inspection before trusting the parser on a full harvest — this "
            "endpoint's\n    exact response shape has not been live-verified against this parser yet.",
            file=sys.stderr,
        )
        sys.exit(2)

    heading = args[0]
    max_pages = None
    if "--max-pages" in args:
        i = args.index("--max-pages")
        max_pages = int(args[i + 1])
    dump_first = "--dump-first-page" in args

    slug = to_compound_id(heading)
    ANNOTATIONS_DIR.mkdir(parents=True, exist_ok=True)
    out_file = ANNOTATIONS_DIR / f"{slug}.json"

    heading_q = urllib.parse.quote(heading)
    page = 1
    total_pages = None
    completed = False
    # Merge into whatever's already cached — a partial harvest interrupted by a
    # block and resumed later should accumulate, not stomp prior progress.
    index: dict[str, list[str]] = _load_annotation_cache(slug)

    while True:
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/annotations/heading/JSON?heading={heading_q}&page={page}"
        try:
            data = _pubchem_get(url)
        except (PubChemBlocked, PubChemCongested) as e:
            print(f"Stopped at page {page}/{total_pages or '?'}: {e}", file=sys.stderr)
            break

        if dump_first and page == 1:
            raw_out = ANNOTATIONS_DIR / f"_raw_sample_{slug}.json"
            raw_out.write_text(json.dumps(data, indent=2))
            print(f"Dumped raw page 1 to {raw_out} for schema inspection.", file=sys.stderr)

        ann_root = (data or {}).get("Annotations", {})
        if total_pages is None:
            total_pages = ann_root.get("TotalPages") or ann_root.get("TotalPage")
        annotations = ann_root.get("Annotation", [])
        if not annotations:
            print(
                f"No 'Annotation' list found on page {page} — response schema may differ from "
                f"what this parser expects. Top-level keys seen: {list((data or {}).keys())}. "
                f"Re-run with --dump-first-page and inspect the raw JSON before retrying. Stopping.",
                file=sys.stderr,
            )
            break

        for entry in annotations:
            cids = (entry.get("LinkedRecords") or {}).get("CID") or []
            texts = []
            for d in entry.get("Data", []):
                for v in d.get("Value", {}).get("StringWithMarkup", []):
                    s = v.get("String", "").strip()
                    if s:
                        texts.append(s)
            for cid in cids:
                index.setdefault(str(cid), []).extend(texts)

        eta_str = ""
        if total_pages:
            eta = (total_pages - page) * PUBCHEM_MIN_INTERVAL
            eta_str = f", ETA ~{eta:.0f}s remaining"
        print(
            f"  page {page}/{total_pages or '?'}: {len(annotations)} annotations, "
            f"{len(index)} unique CIDs so far{eta_str}",
            file=sys.stderr,
        )

        if max_pages and page >= max_pages:
            print(f"Stopping at --max-pages {max_pages} (of {total_pages or '?'} total).", file=sys.stderr)
            break
        if total_pages and page >= total_pages:
            completed = True
            break
        page += 1

    if not index:
        print(f"No annotations collected — leaving {out_file} untouched.", file=sys.stderr)
        sys.exit(1)

    out_file.write_text(json.dumps(index, indent=2))
    status = "complete" if completed else "PARTIAL (interrupted — re-run to continue)"
    print(f"Wrote {len(index)} CIDs to {out_file} [{status}]")
    if not completed:
        sys.exit(1)


# ── flavordb ───────────────────────────────────────────────────────────────────

def _flavordb_fetch_entity(entity_id: int) -> None:
    print(f"[flavordb] fetching entity {entity_id}...", file=sys.stderr)
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
    print(f"[flavordb] found {entity['name']!r} with {len(molecules)} molecule(s)", file=sys.stderr)
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

    print(f"[flavordb] searching for {query!r}...", file=sys.stderr)
    results = _fetch_flavordb_search(query)

    if not results or len(results) == 0:
        print("[flavordb] not found", file=sys.stderr)
        print(json.dumps({"status": "not_found"}))
        return

    if len(results) == 1:
        print("[flavordb] 1 match, auto-fetching", file=sys.stderr)
        _flavordb_fetch_entity(results[0]["entity_id"])
        return

    print(f"[flavordb] {len(results)} matches, letting caller pick", file=sys.stderr)
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
    elif cmd == "fetch-annotations":
        cmd_fetch_annotations(args)
    elif cmd == "flavordb":
        cmd_flavordb(args)
    else:
        print(f"Unknown command: {cmd!r}\n{__doc__}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
