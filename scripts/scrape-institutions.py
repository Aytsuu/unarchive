"""Refresh the public CHED HEIDA institution catalog; Python 3 standard library only.

Source: https://heida.ched.gov.ph/hei-directory (public paginated regional directory).
Run: python scripts/scrape-institutions.py
Only institution names, public source codes and regions are retained.
The catalog is not replaced if the directory could not be read completely.
"""
import concurrent.futures
import hashlib
import json
import math
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://heida.ched.gov.ph/hei-directory"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data" / "philippine-institutions.json"
CACHE_DIR = Path(tempfile.gettempdir()) / "unarchive-ched-catalog-cache"
CACHE_MAX_AGE_SECONDS = 3600
HEADERS = {"User-Agent": "Unarchive institution catalog (+https://heida.ched.gov.ph/hei-directory)"}


def fetch(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as response:
                text = response.read().decode("utf-8")
            time.sleep(0.15)
            return text
        except (OSError, urllib.error.HTTPError) as error:
            if attempt == 3:
                raise RuntimeError(f"Failed to read {url}: {error}") from error
            time.sleep(1.5 * (attempt + 1))


class RegionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.in_heading = False
        self.name = []
        self.regions = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            match = re.fullmatch(r"https://heida\.ched\.gov\.ph/hei-directory/(\d+)", attrs.get("href", ""))
            self.href = match.group(1) if match else None
        if self.href and tag == "h3":
            self.in_heading = True
            self.name = []

    def handle_data(self, data):
        if self.in_heading:
            self.name.append(data)

    def handle_endtag(self, tag):
        if tag == "h3" and self.in_heading:
            self.regions.append((self.href, " ".join("".join(self.name).split())))
            self.in_heading = False
        if tag == "a":
            self.href = None


class InstitutionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_body = False
        self.in_row = False
        self.cell = -1
        self.in_span = False
        self.span = []
        self.spans = []
        self.records = []
        self.all_text = []

    def handle_starttag(self, tag, attrs):
        if tag == "tbody":
            self.in_body = True
        elif self.in_body and tag == "tr":
            self.in_row, self.cell, self.spans = True, -1, []
        elif self.in_row and tag == "td":
            self.cell += 1
        elif self.in_row and self.cell == 0 and tag == "span":
            self.in_span, self.span = True, []

    def handle_data(self, data):
        self.all_text.append(data)
        if self.in_span:
            self.span.append(data)

    def handle_endtag(self, tag):
        if tag == "span" and self.in_span:
            self.spans.append(" ".join("".join(self.span).split()))
            self.in_span = False
        elif tag == "tr" and self.in_row:
            if len(self.spans) < 2 or not all(self.spans[:2]):
                raise ValueError("Institution row is missing its name or code")
            self.records.append(tuple(self.spans[:2]))
            self.in_row = False
        elif tag == "tbody":
            self.in_body = False

    def count(self):
        match = re.search(r"([\d,]+)\s+Records Found", " ".join(self.all_text))
        if not match:
            raise ValueError("Could not find record count")
        return int(match.group(1).replace(",", ""))


def read_page(region_id, region_name, page):
    cache_path = CACHE_DIR / f"region-{region_id}-page-{page}.json"
    if cache_path.exists() and time.time() - cache_path.stat().st_mtime < CACHE_MAX_AGE_SECONDS:
        try:
            saved = json.loads(cache_path.read_text(encoding="utf-8"))
            if saved["region_id"] == region_id and saved["page"] == page and saved["region_name"] == region_name:
                return region_id, page, saved["total"], saved["records"]
        except (OSError, KeyError, ValueError, TypeError):
            pass
    parser = InstitutionParser()
    parser.feed(fetch(f"{BASE}/{region_id}?page={page}"))
    total = parser.count()
    records = [{"id": f"ched-{region_id}-{code}-{hashlib.sha256(name.casefold().encode('utf-8')).hexdigest()[:12]}", "name": name, "region": region_name} for name, code in parser.records]
    saved = {"region_id": region_id, "region_name": region_name, "page": page, "total": total, "records": records}
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    temporary = cache_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
    temporary.replace(cache_path)
    return region_id, page, total, records


def main():
    parser = RegionParser()
    parser.feed(fetch(BASE))
    regions = parser.regions
    if not regions:
        raise RuntimeError("No regional directories found")
    print(f"Found {len(regions)} regions", flush=True)
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(read_page, region_id, name, 1) for region_id, name in regions]
        for future in concurrent.futures.as_completed(futures):
            region_id, page, total, records = future.result()
            results[(region_id, page)] = (total, records)
        rest = []
        for region_id, name in regions:
            total = results[(region_id, 1)][0]
            print(f"{name}: {total} records", flush=True)
            for page in range(2, math.ceil(total / 10) + 1):
                rest.append(pool.submit(read_page, region_id, name, page))
        for index, future in enumerate(concurrent.futures.as_completed(rest), 1):
            region_id, page, total, records = future.result()
            results[(region_id, page)] = (total, records)
            if index % 25 == 0 or index == len(rest):
                print(f"Fetched {index}/{len(rest)} remaining pages", flush=True)
    catalog = []
    for region_id, name in regions:
        expected = results[(region_id, 1)][0]
        pages = [results[(region_id, page)] for page in range(1, math.ceil(expected / 10) + 1)] if expected else [results[(region_id, 1)]]
        if any(total != expected for total, _ in pages):
            raise RuntimeError(f"Directory changed during retrieval: {name}")
        rows = [row for _, records in pages for row in records]
        if len(rows) != expected:
            raise RuntimeError(f"Incomplete directory {name}: {len(rows)} of {expected}")
        catalog.extend(rows)
    # Identical region/code/name records cannot be distinguished by the source.
    # Keep one selectable entry for each exact identity, while preserving rows
    # with reused codes but different names.
    unique = {}
    for row in catalog:
        previous = unique.get(row["id"])
        if previous and (previous["name"].casefold() != row["name"].casefold() or previous["region"] != row["region"]):
            raise RuntimeError("Identifier collision; refusing to write catalog")
        unique.setdefault(row["id"], row)
    duplicate_count = len(catalog) - len(unique)
    if duplicate_count:
        print(f"Deduplicated {duplicate_count} exact source identities", flush=True)
    catalog = list(unique.values())
    catalog.sort(key=lambda item: (item["name"].casefold(), item["region"], item["id"]))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Wrote {len(catalog)} institutions to {OUTPUT}", flush=True)
    if CACHE_DIR.is_dir():
        for cache_file in CACHE_DIR.iterdir():
            if cache_file.is_file() and re.fullmatch(r"region-\d+-page-\d+\.(json|tmp)", cache_file.name):
                cache_file.unlink()
        if not any(CACHE_DIR.iterdir()):
            CACHE_DIR.rmdir()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
