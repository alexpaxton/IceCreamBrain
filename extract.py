"""
Extract Hello, My Name Is Ice Cream (Dana Cree) PDF into organized markdown.

Output:
  reference.md         — all knowledge, section intros, appendix content
  recipes/<name>.md    — one file per recipe
"""

import pdfplumber
import re
import os
from pathlib import Path

PDF_PATH = "/Users/xx/src/ice-cream/hello-my-name-is-ice-cream.pdf"
OUT_DIR = Path("/Users/xx/src/ice-cream")
RECIPES_DIR = OUT_DIR / "recipes"

MAKES_PAT = re.compile(r'Makes\s+(just\s+)?(between|about|one|two|\d)', re.IGNORECASE)

# Page ranges (0-indexed) to completely skip
SKIP_RANGES = [(0, 10), (540, 600)]

# Page ranges (0-indexed) that are recipe content (not reference)
# Everything outside these ranges (and not skipped) goes to reference.md
RECIPE_RANGE = (110, 520)

# Section labels by first page of that section (0-indexed)
SECTION_LABELS = [
    (110, "Custard Ice Creams"),
    (175, "Philadelphia-Style Ice Creams"),
    (236, "Sherbets"),
    (294, "Frozen Yogurts"),
    (347, "Add-Ins"),
    (442, "Composed Scoops"),
    (499, "Basics"),
]

def get_section(page_idx):
    label = "Recipes"
    for start, name in SECTION_LABELS:
        if page_idx >= start:
            label = name
    return label

def slugify(name):
    name = re.sub(r'[^\w\s-]', '', name)
    name = name.strip().lower()
    name = re.sub(r'\s+', '-', name)
    name = re.sub(r'-+', '-', name)
    return name[:70]

STEP_LABEL_PAT = re.compile(r'^([A-Z][A-Za-z ,\-\']{2,50}?)\.\s{1,2}([A-Z].+)$')

def text_to_md(text):
    """Light markdown formatting of raw PDF text."""
    lines = text.split('\n')
    out = []
    for line in lines:
        line = line.rstrip()
        stripped = line.strip()
        if not stripped:
            if out and out[-1] != '':
                out.append('')
            continue
        # All-caps subheaders like TEXTURE AGENTS
        if re.match(r'^[A-Z][A-Z\s&/,–\-]{4,}$', stripped):
            out.append(f'\n**{stripped}**\n')
            continue
        # Step labels: "Boil the dairy. Put the cream…" → **Boil the dairy.** Put the cream…
        m = STEP_LABEL_PAT.match(stripped)
        if m:
            label, rest = m.groups()
            # Short phrase (≤7 words) = step label; longer = likely a sentence fragment
            if len(label.split()) <= 7:
                out.append(f'\n**{label}.** {rest}')
                continue
        out.append(line)
    return '\n'.join(out)

# ── Load all pages ──────────────────────────────────────────────────────────
print("Loading PDF…")
with pdfplumber.open(PDF_PATH) as pdf:
    total = len(pdf.pages)
    all_texts = []
    for i, page in enumerate(pdf.pages):
        if i % 50 == 0:
            print(f"  reading page {i+1}/{total}")
        all_texts.append(page.extract_text() or "")
print(f"Loaded {total} pages.")

# ── Identify recipe start pages ─────────────────────────────────────────────
recipe_starts = []  # (start_page_idx, title, section)
r_start, r_end = RECIPE_RANGE

for i in range(r_start, r_end):
    text = all_texts[i]
    if not MAKES_PAT.search(text):
        continue

    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        continue

    if MAKES_PAT.match(lines[0]):
        # "Makes" is the very first line — title was on previous page
        title_page = i - 1
        if title_page >= 0:
            prev_lines = [l.strip() for l in all_texts[title_page].split('\n') if l.strip()]
            if prev_lines:
                title = ' '.join(prev_lines[:2])  # handle split titles
                recipe_starts.append((title_page, title, get_section(title_page)))
    else:
        # Title is the first line of this page (combined title+Makes page)
        title = lines[0]
        recipe_starts.append((i, title, get_section(i)))

# Deduplicate (keep first occurrence per page)
seen = set()
unique_starts = []
for item in sorted(recipe_starts, key=lambda x: x[0]):
    if item[0] not in seen:
        unique_starts.append(item)
        seen.add(item[0])
recipe_starts = unique_starts
print(f"Detected {len(recipe_starts)} recipes.")

# ── Build recipe page spans ─────────────────────────────────────────────────
recipe_spans = []  # (start_idx, end_idx_exclusive, title, section)
for j, (start_pg, title, section) in enumerate(recipe_starts):
    end_pg = recipe_starts[j + 1][0] if j + 1 < len(recipe_starts) else r_end
    recipe_spans.append((start_pg, end_pg, title, section))

# Set of pages that belong to recipes
recipe_pages = set()
for start, end, _, _ in recipe_spans:
    for p in range(start, end):
        recipe_pages.add(p)

# ── Write reference.md ──────────────────────────────────────────────────────
def is_skip(i):
    for s, e in SKIP_RANGES:
        if s <= i < e:
            return True
    return False

ref_sections = []
current_ref_block = []
current_ref_start = None

for i, text in enumerate(all_texts):
    if is_skip(i):
        continue
    if i in recipe_pages:
        if current_ref_block:
            ref_sections.append((current_ref_start, '\n\n---\n\n'.join(current_ref_block)))
            current_ref_block = []
            current_ref_start = None
        continue
    if text.strip():
        if current_ref_start is None:
            current_ref_start = i
        current_ref_block.append(text_to_md(text))

if current_ref_block:
    ref_sections.append((current_ref_start, '\n\n---\n\n'.join(current_ref_block)))

ref_md = "# Hello, My Name Is Ice Cream — Reference\n\n*Dana Cree (Clarkson Potter, 2017)*\n\n"
ref_md += '\n\n'.join(block for _, block in ref_sections)

ref_path = OUT_DIR / "reference.md"
ref_path.write_text(ref_md, encoding='utf-8')
print(f"Wrote {ref_path} ({len(ref_md):,} chars)")

# ── Write recipe files ───────────────────────────────────────────────────────
RECIPES_DIR.mkdir(exist_ok=True)

name_counts = {}
for start, end, title, section in recipe_spans:
    pages_text = []
    for p in range(start, end):
        t = all_texts[p].strip()
        if t:
            pages_text.append(text_to_md(t))

    if not pages_text:
        continue

    slug = slugify(title)
    # Deduplicate slugs
    if slug in name_counts:
        name_counts[slug] += 1
        slug = f"{slug}-{name_counts[slug]}"
    else:
        name_counts[slug] = 1

    # Strip repeated title from the top of the body text
    title_norm = re.sub(r'\s+', ' ', title).strip().lower()
    clean_pages = []
    for j, pt in enumerate(pages_text):
        if j == 0:
            first_line = pt.split('\n')[0].strip()
            if re.sub(r'\s+', ' ', first_line).lower() == title_norm:
                pt = '\n'.join(pt.split('\n')[1:]).lstrip()
        clean_pages.append(pt)

    md = f"# {title}\n\n**Section:** {section}\n\n"
    md += '\n\n'.join(clean_pages)

    out_path = RECIPES_DIR / f"{slug}.md"
    out_path.write_text(md, encoding='utf-8')

print(f"Wrote {len(recipe_spans)} recipe files to {RECIPES_DIR}/")
print("Done.")
