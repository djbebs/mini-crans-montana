#!/usr/bin/env python3
"""Check deployed Street View counts, byte provenance and every local report link."""

from __future__ import annotations

import argparse
import csv
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

from importlib.util import module_from_spec, spec_from_file_location


SCRIPT = Path(__file__).resolve()
sys.dont_write_bytecode = True
spec = spec_from_file_location("streetview_packager", SCRIPT.with_name("package-streetview-survey.py"))
packager = module_from_spec(spec)
spec.loader.exec_module(packager)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


class ReportParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.add(attrs["id"])
        for key in ("href", "src"):
            if key in attrs:
                self.links.append(attrs[key])


def csv_rows(path: Path) -> list[dict]:
    return list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig"), newline="")))


def jpeg_dimensions(content: bytes) -> tuple[int, int]:
    require(content[:2] == b"\xff\xd8" and content[-2:] == b"\xff\xd9", "Invalid JPEG boundaries")
    offset = 2
    while offset < len(content):
        if content[offset] != 255:
            offset += 1
            continue
        while content[offset] == 255:
            offset += 1
        marker = content[offset]
        offset += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        length = int.from_bytes(content[offset:offset + 2], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            height = int.from_bytes(content[offset + 3:offset + 5], "big")
            width = int.from_bytes(content[offset + 5:offset + 7], "big")
            return width, height
        require(length >= 2, "Invalid JPEG marker segment")
        offset += length
    raise AssertionError("JPEG dimensions not found")


def validate(source: Path | None, target: Path) -> dict:
    if source is None:
        source = packager.DEFAULT_SOURCE if packager.DEFAULT_SOURCE.exists() else None
        if source is not None and not source.is_dir():
            raise NotADirectoryError(f"Default source package path is not a directory: {source}")
    elif not source.is_dir():
        raise FileNotFoundError(f"Explicit source package directory does not exist: {source}")
    source = source.resolve() if source is not None else None
    target = target.resolve()
    data_bytes = (target / "survey-data.json").read_bytes()
    if source is not None:
        require(data_bytes == (source / "survey-data.json").read_bytes(), "Source survey JSON changed")
    data = json.loads(data_bytes)
    captures = data["captures"]
    require(len(captures) == 55, "Capture count differs from 55")
    require(len({c["panorama_id"] for c in captures}) == 24, "Panorama count differs from 24")
    require(len(data["buildings"]) == 22, "Visual-ID count differs from 22")
    rows = csv_rows(target / "index.csv")
    require(len(rows) == 120, "Capture index row count differs from 120")
    if source is not None:
        source_rows = csv_rows(source / "index.csv")
        require(len(source_rows) == 120, "Source capture index row count differs from 120")
        for original, deployed in zip(source_rows, rows):
            for column in original:
                if column != "building_screenshot":
                    require(original[column] == deployed[column], f"CSV source string changed: {column} / {original['capture_id']}")
    for deployed in rows:
        require(deployed["building_screenshot"] == deployed["screenshot"], "Deployed index does not use shared images")
        require(packager.confined(target, deployed["building_screenshot"]).is_file(), "Broken shared screenshot reference")
    require(sum(bool(row["building_id"]) for row in rows) == 116, "Nonempty visual-reference association count differs from 116")
    require({row["capture_id"] for row in rows if not row["building_id"]} == {"C009", "C015", "C024", "C036"}, "Unassigned capture rows differ from the four expected records")

    expected_associations = [(c["capture_id"], visual_id) for c in captures for visual_id in (c["building_ids"] or [""])]
    require(expected_associations == [(r["capture_id"], r["building_id"]) for r in rows], "CSV capture/reference rows differ from JSON")
    known_ids = {b["building_id"] for b in data["buildings"]}
    for capture in captures:
        require(set(capture["building_ids"]) <= known_ids, "Unknown visual ID")
        relative = capture["screenshot"]
        image = packager.confined(target, relative).read_bytes()
        if source is not None:
            require(image == packager.confined(source, relative).read_bytes(), f"Original JPG changed: {relative}")
        require(jpeg_dimensions(image) == (624, 667), f"Unexpected screenshot dimensions: {relative}")
        text = f'evidence/{capture["capture_id"]}.txt'
        text_bytes = packager.confined(target, text).read_bytes()
        if source is not None:
            require(text_bytes == packager.confined(source, text).read_bytes(), f"Original TXT changed: {text}")

    for relative in packager.CONTEXT_IMAGES:
        image = packager.confined(target, relative).read_bytes()
        jpeg_dimensions(image)
        if source is not None:
            require(image == packager.confined(source, relative).read_bytes(), f"Context JPG changed: {relative}")
    require(len(csv_rows(target / "panoramas.csv")) == 24, "Panorama CSV count mismatch")
    require(len(csv_rows(target / "buildings.csv")) == 22, "Visual-ID CSV count mismatch")
    catalog = csv_rows(target / "gallery-catalog.csv")
    require(len(catalog) == 32 and sum(bool(t["capture_id"]) for t in catalog) == 4, "Gallery sample counts changed")
    require(not (target / "buildings").exists(), "Duplicated building screenshots were deployed")

    html_cache = {}
    def html_info(relative: str) -> ReportParser:
        if relative not in html_cache:
            parsed = ReportParser()
            parsed.feed(packager.confined(target, relative).read_text(encoding="utf-8"))
            html_cache[relative] = parsed
        return html_cache[relative]

    checked_links = 0
    def check_link(origin: str, reference: str):
        nonlocal checked_links
        link = urlsplit(reference)
        if link.scheme or link.netloc or reference.startswith("//"):
            return
        if not reference:
            return
        base = Path(origin).parent
        relative = (base / unquote(link.path)).as_posix() if link.path else origin
        linked = packager.confined(target, relative)
        require(linked.is_file(), f"Broken local link in {origin}: {reference}")
        if link.fragment and linked.suffix.lower() == ".html":
            require(unquote(link.fragment) in html_info(relative).ids, f"Missing HTML anchor: {origin} -> {reference}")
        checked_links += 1

    for relative in ("index.html",):
        for reference in html_info(relative).links:
            check_link(relative, reference)
    svg = ET.fromstring((target / "coverage-map.svg").read_bytes())
    for element in svg.iter():
        for key, value in element.attrib.items():
            if key in ("href", "{http://www.w3.org/1999/xlink}href"):
                check_link("coverage-map.svg", value)
    for relative in ("README.md", "DEPLOYMENT-NOTES.md"):
        text = (target / relative).read_text(encoding="utf-8")
        for reference in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            check_link(relative, reference)
    require("building-folder copy" not in (target / "README.md").read_text(encoding="utf-8"), "README still claims duplicate image folders")

    provenance = json.loads((target / "provenance-sha256.json").read_bytes())
    for record in provenance["files"]:
        content = packager.confined(target, record["path"]).read_bytes()
        require(len(content) == record["bytes"] and hashlib.sha256(content).hexdigest() == record["sha256"], f"Provenance hash mismatch: {record['path']}")
        if record["source_path"]:
            if not record["transformation"]:
                require(record["sha256"] == record["source_sha256"], f"Unchanged-source provenance is inconsistent: {record['path']}")
            if source is not None:
                original = packager.confined(source, record["source_path"]).read_bytes()
                require(hashlib.sha256(original).hexdigest() == record["source_sha256"], f"Source provenance mismatch: {record['path']}")
                if not record["transformation"]:
                    require(original == content, f"Unchanged-source file was modified: {record['path']}")
    checksums = {}
    for line in (target / "checksums.sha256").read_text(encoding="utf-8").splitlines():
        digest, relative = line.split("  ", 1)
        checksums[relative] = digest
        require(hashlib.sha256(packager.confined(target, relative).read_bytes()).hexdigest() == digest, f"Payload checksum mismatch: {relative}")
    files = {p.relative_to(target).as_posix() for p in target.rglob("*") if p.is_file()}
    require(files == set(checksums) | {"checksums.sha256"}, "Payload contains untracked or missing files")
    expected_files = {r["path"] for r in provenance["files"]} | {"checksums.sha256", "provenance-sha256.json"}
    require(files == expected_files, "Provenance file coverage is incomplete")
    return {"status": "PASS", "captures": 55, "panoramas": 24, "visual_ids": 22,
            "index_rows": 120, "gallery_tiles": 32, "gallery_full_views_opened": 4,
            "nonempty_visual_associations": 116, "unassigned_captures": 4,
            "source_comparison": "performed" if source is not None else "unavailable",
            "original_jpgs_byte_identical": True if source is not None else None,
            "original_txts_byte_identical": True if source is not None else None,
            "source_json_byte_identical": True if source is not None else None,
            "all_csv_source_strings_preserved_except_shared_image_paths": True if source is not None else None,
            "deployed_manifest_hashes_valid": True,
            "local_links_checked": checked_links, "payload_files": len(files),
            "payload_bytes": sum(p.stat().st_size for p in target.rglob("*") if p.is_file())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=None,
                        help="Optional original package; an explicitly missing path fails. If omitted, compare the sibling source when present.")
    parser.add_argument("--target", type=Path, default=packager.DEFAULT_TARGET)
    args = parser.parse_args()
    print(json.dumps(validate(args.source, args.target), ensure_ascii=False))
