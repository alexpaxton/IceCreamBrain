#!/usr/bin/env python3
"""
sweet_level.py — Sugar split calculator for ice cream recipes.

Usage:
    python sweet_level.py <sweetness_pct> <total_weight_g> [sweetener_name]

Arguments:
    sweetness_pct    Target sweetness, 0–100 (0 = all glucose, 100 = all sucrose)
    total_weight_g   Total sugar weight in grams
    sweetener_name   Optional alternative sweetener (must match sweetener-reference.csv)

Exit codes:
    0  Success
    1  Input error
    2  Sweetener not found in reference table (caller should trigger web lookup)
"""

import csv
import sys
from pathlib import Path

REFERENCE_CSV = Path(__file__).parent / "sweetener-reference.csv"

FPD_LOW = 1.15
FPD_HIGH = 1.60
FPD_TARGET = 1.2  # midpoint suggestion when out of range

SUCROSE_FPD = 1.0
GLUCOSE_FPD = 1.9


def load_sweetener(name: str) -> dict | None:
    name_lower = name.lower().strip()
    rows = []
    with open(REFERENCE_CSV, newline="") as f:
        rows = list(csv.DictReader(f))

    for row in rows:
        row_name = row["Sweetener"].lower().strip()
        if row_name == name_lower:
            return row
        if name_lower == "dextrose" and "glucose" in row_name:
            return row

    # "honey" without variety → match "honey (average)"
    if name_lower == "honey":
        for row in rows:
            if row["Sweetener"].lower().startswith("honey (average)"):
                return row

    return None


def calc_default(sweetness_pct: float, total_weight: float) -> dict:
    sucrose_g = total_weight * (sweetness_pct / 100)
    glucose_g = total_weight * (1 - sweetness_pct / 100)
    return {"sucrose_g": sucrose_g, "alt_g": None, "alt_name": None, "glucose_g": glucose_g}


def calc_alternative(sweetness_pct: float, total_weight: float, sweetener: dict) -> tuple[dict, list[str]]:
    alt_rel = float(sweetener["Relative_Sweetness"])
    alt_name = sweetener["Sweetener"]
    warnings = []

    target_sucrose_g = total_weight * (sweetness_pct / 100)
    alt_g = target_sucrose_g * (100 / alt_rel)
    glucose_g = total_weight - alt_g

    if glucose_g < 0:
        alt_g = total_weight
        glucose_g = 0
        warnings.append(
            f"{alt_name} is sweet enough that {alt_g:.1f}g hits the sweetness target — "
            "no glucose needed. Consider reducing total weight if you want to leave room for glucose's texture benefits."
        )
    elif alt_g > total_weight:
        needed = target_sucrose_g * (100 / alt_rel)
        max_pct = (alt_g * alt_rel / 100) / total_weight * 100
        alt_g = total_weight
        glucose_g = 0
        warnings.append(
            f"{alt_name} can't reach {sweetness_pct}% sweetness at {total_weight}g — "
            f"you'd need {needed:.1f}g, which exceeds the budget. "
            f"Maximum achievable sweetness at this weight: {max_pct:.1f}%."
        )

    return {"sucrose_g": 0.0, "alt_g": alt_g, "alt_name": alt_name, "glucose_g": glucose_g}, warnings


def calc_fpd(split: dict, alt_fpd: float | None) -> float:
    total = (split.get("sucrose_g") or 0) + (split.get("glucose_g") or 0) + (split.get("alt_g") or 0)
    if total == 0:
        return 0.0
    index = (
        (split.get("sucrose_g") or 0) * SUCROSE_FPD
        + (split.get("glucose_g") or 0) * GLUCOSE_FPD
        + (split.get("alt_g") or 0) * (alt_fpd if alt_fpd is not None else SUCROSE_FPD)
    )
    return index / total


def suggest_fpd_adjustment(split: dict, alt_fpd: float | None, total_weight: float) -> dict:
    alt_g = split.get("alt_g") or 0
    fpd_alt = alt_fpd if (alt_g and alt_fpd is not None) else SUCROSE_FPD

    # Solve for glucose_adj keeping alt_g fixed:
    # (sucrose_adj * 1.0 + glucose_adj * 1.9 + alt_g * fpd_alt) / total = FPD_TARGET
    # where sucrose_adj = total - glucose_adj - alt_g
    # → glucose_adj = (total * (T - 1) + alt_g * (1 - fpd_alt)) / (FPD_glucose - FPD_sucrose)
    numerator = total_weight * (FPD_TARGET - 1) + alt_g * (1 - fpd_alt)
    glucose_adj = numerator / (GLUCOSE_FPD - SUCROSE_FPD)
    glucose_adj = max(0.0, min(glucose_adj, total_weight - alt_g))
    sucrose_adj = max(0.0, total_weight - glucose_adj - alt_g)

    adj_fpd = (sucrose_adj * SUCROSE_FPD + glucose_adj * GLUCOSE_FPD + alt_g * fpd_alt) / total_weight

    return {
        "glucose_adj_g": glucose_adj,
        "sucrose_adj_g": sucrose_adj,
        "alt_g": alt_g,
        "adj_fpd": adj_fpd,
    }


def format_output(sweetness_pct: float, total_weight: float, split: dict, fpd_index: float, warnings: list[str], adj: dict | None) -> str:
    lines = [f"## Sugar split — {total_weight:.0f}g at {sweetness_pct:.0f}% sweet", ""]
    lines.append("| Qty | Ingredient |")
    lines.append("|-----|-----------|")

    if split["sucrose_g"]:
        lines.append(f"| {split['sucrose_g']:.1f}g | Sucrose |")
    if split["alt_g"]:
        lines.append(f"| {split['alt_g']:.1f}g | {split['alt_name']} |")
    if split["glucose_g"]:
        lines.append(f"| {split['glucose_g']:.1f}g | Glucose / Dextrose |")

    lines.append("")

    if fpd_index < FPD_LOW:
        fpd_status = "too low — may freeze hard"
    elif fpd_index > FPD_HIGH:
        fpd_status = "too high — may be gummy or too soft"
    else:
        fpd_status = "in range"

    lines.append(f"**FPD index:** {fpd_index:.2f} ({fpd_status})")

    if adj and (fpd_index < FPD_LOW or fpd_index > FPD_HIGH):
        adj_fpd = adj["adj_fpd"]
        if FPD_LOW <= adj_fpd <= FPD_HIGH:
            lines.append(
                f"To bring FPD to {adj_fpd:.2f}, use {adj['glucose_adj_g']:.1f}g glucose "
                f"and {adj['sucrose_adj_g']:.1f}g sucrose instead."
            )
        else:
            lines.append(
                f"Best achievable FPD with this sweetener mix: {adj_fpd:.2f} "
                f"({adj['glucose_adj_g']:.1f}g glucose / {adj['sucrose_adj_g']:.1f}g sucrose). "
                f"Consider reducing the amount of high-FPD sweetener to bring it in range."
            )

    for w in warnings:
        lines.append(f"\n> Warning: {w}")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    try:
        sweetness_pct = float(sys.argv[1])
        total_weight = float(sys.argv[2])
    except ValueError:
        print("Error: sweetness_pct and total_weight_g must be numbers.", file=sys.stderr)
        sys.exit(1)

    if not (0 <= sweetness_pct <= 100):
        print("Error: sweetness_pct must be between 0 and 100.", file=sys.stderr)
        sys.exit(1)

    if total_weight <= 0:
        print("Error: total_weight_g must be positive.", file=sys.stderr)
        sys.exit(1)

    alt_name = sys.argv[3] if len(sys.argv) >= 4 else None
    warnings = []
    alt_fpd = None
    adj = None

    if alt_name:
        sweetener = load_sweetener(alt_name)
        if sweetener is None:
            print(f"NOT_FOUND:{alt_name}", file=sys.stderr)
            sys.exit(2)
        alt_fpd = float(sweetener["FPD"])
        split, warnings = calc_alternative(sweetness_pct, total_weight, sweetener)

        if sweetener["Sweetener"].lower().startswith("honey") and "average" in sweetener["Sweetener"].lower():
            warnings.append(
                "Using average honey values. Actual sweetness varies by variety (e.g. acacia vs. manuka). "
                "If you're using a specific type, I can look it up as a separate entry."
            )
    else:
        split = calc_default(sweetness_pct, total_weight)

    fpd_index = calc_fpd(split, alt_fpd)

    if fpd_index < FPD_LOW or fpd_index > FPD_HIGH:
        adj = suggest_fpd_adjustment(split, alt_fpd, total_weight)

    print(format_output(sweetness_pct, total_weight, split, fpd_index, warnings, adj))


if __name__ == "__main__":
    main()
