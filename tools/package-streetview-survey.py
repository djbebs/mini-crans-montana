#!/usr/bin/env python3
"""Package the recorded Ycoor evidence without duplicating images per visual ID."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re


REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO.parent / "streetview-survey-2026-11-15"
DEFAULT_TARGET = REPO / "crans-montana-p06/assets/streetview-survey/2026-11-15"
FIXED_FILES = (
    "survey-data.json", "index.csv", "buildings.csv", "panoramas.csv",
    "coverage-gaps.csv", "gallery-catalog.csv", "shop-tour-panoramas.json",
    "coverage-map.svg", "coverage-map.png", "index.html", "README.md",
)
CONTEXT_IMAGES = (
    "evidence/coverage-pilot-overlay.jpg", "evidence/coverage-wide-overlay.jpg",
    "evidence/shop-gallery-top.jpg", "evidence/shop-gallery-middle.jpg",
    "evidence/shop-gallery-page3.jpg", "evidence/shop-gallery-bottom.jpg",
)

DEPLOYMENT_NOTES = """# Notes de déploiement / Deployment notes

## Français

Ce dossier contient les 55 captures originales de l'enquête Ycoor des 15–16 novembre 2026, 24 identifiants de panoramas et 22 repères visuels. Les 120 lignes de l'index comprennent 116 associations à un repère et quatre captures non assignées (C009, C015, C024 et C036), pas 120 photographies différentes.

Tous les identifiants B, S et U sont des repères visuels non vérifiés. Ils ne sont pas des identifiants cadastraux et aucun n'est rattaché à un maillage du Pixel Atlas. Les coordonnées sont celles de la caméra rapportées par l'URL du visualiseur, jamais celles d'un bâtiment. La précision physique du GPS et l'étalonnage du cap par rapport au nord vrai restent non vérifiés, particulièrement pour les sphères de contributeurs.

Chaque capture est stockée une seule fois dans `evidence/`. Dans `index.csv`, les colonnes `screenshot` et `building_screenshot` pointent vers ce même fichier partagé. Les 120 lignes sont conservées. Les JPG et les fichiers TXT d'origine sont identiques, octet pour octet, aux preuves de l'enquête. Le JSON source est inchangé. La galerie autonome, le fichier SVG et le présent guide sont adaptés uniquement pour les liens de déploiement et l'absence de copies par bâtiment.

L'enquête est partielle. Les dates historiques n'ont pas été auditées intégralement et la visite intérieure n'a pas été parcourue entièrement. Le catalogue contient 32 vignettes chargées; seuls quatre panoramas ont été ouverts. Consultez [les lacunes](coverage-gaps.csv), [le catalogue](gallery-catalog.csv) et [la méthode](README.md). Les surlignages des cartes Google sont un contexte au moment de l'enquête, pas une preuve d'exhaustivité. Les captures conservent les mentions d'attribution visibles.

## English

This folder contains the 55 original captures from the 15–16 November 2026 Ycoor survey, 24 panorama IDs and 22 visual references. The index has 120 rows: 116 nonempty capture/reference associations and four unassigned captures (C009, C015, C024 and C036), not 120 distinct photographs.

All B, S and U IDs are unverified visual references. They are not cadastral IDs and none is attached to a Pixel Atlas mesh. Coordinates are camera locations reported by the viewer URL, never building coordinates. Physical GPS accuracy and true-north heading calibration remain unverified, especially for contributor spheres.

Each capture is stored once under `evidence/`. Both `screenshot` and `building_screenshot` in `index.csv` resolve to that shared file; all 120 rows remain. Original JPG and TXT evidence is byte-identical to the survey source. Source JSON is unchanged. The standalone gallery, SVG and documentation are adapted only for deployment links and the absence of per-building image copies.

The survey is partial. Historical dates were not fully audited, and the indoor tour was not fully traversed. The catalogue contains 32 loaded tiles; only four full panoramas were opened. See [coverage gaps](coverage-gaps.csv), [gallery catalogue](gallery-catalog.csv) and [method](README.md). Google coverage highlights provide time-of-survey context, not proof of exhaustive enumeration. Visible attribution remains in the original captures.

## Provenance / Provenance

[provenance-sha256.json](provenance-sha256.json) records each deployed file's SHA-256 hash, original source hash when applicable and any deployment-only transformation. [checksums.sha256](checksums.sha256) hashes the deployed payload plus the provenance record. Neither manifest claims source authenticity, calibrated positioning or verified building identity.
"""


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def confined(base: Path, relative: str) -> Path:
    posix = PurePosixPath(relative)
    if posix.is_absolute() or ".." in posix.parts or "\\" in relative or ":" in relative:
        raise ValueError(f"Unsafe asset path: {relative}")
    target = (base / Path(*posix.parts)).resolve()
    if not target.is_relative_to(base.resolve()):
        raise ValueError(f"Asset leaves intended directory: {relative}")
    return target


def shared_image_csv(source: bytes) -> bytes:
    reader = csv.DictReader(io.StringIO(source.decode("utf-8-sig"), newline=""))
    columns = reader.fieldnames
    if not columns or "building_screenshot" not in columns or "screenshot" not in columns:
        raise ValueError("Capture index lacks screenshot columns")
    rows = list(reader)
    if len(rows) != 120:
        raise ValueError(f"Expected 120 index rows, found {len(rows)}")
    for row in rows:
        row["building_screenshot"] = row["screenshot"]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=columns, lineterminator="\r\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8-sig")


def deployed_readme(source: bytes) -> bytes:
    text = source.decode("utf-8-sig")
    replacements = {
        "index.csv has 120 rows because a screenshot showing several buildings appears once per building association. Do not count these rows as unique screenshots.":
        "index.csv has 120 rows: 116 nonempty capture/visual-reference associations and four unassigned captures (C009, C015, C024 and C036). Do not count these rows as unique screenshots.",
        "- evidence/ contains original captured browser screenshots. buildings/Bxxx/ contains copies of the associated screenshots. A screenshot can occur in several building folders.":
        "- evidence/ contains each original captured browser screenshot once. Visual-ID associations share these images; no per-building duplicate folders are deployed.",
        "index.csv records each capture-building association, the original screenshot path, a building-folder copy, panorama ID":
        "index.csv records each capture/visual-reference association or unassigned capture, the original screenshot path, a shared screenshot reference, panorama ID",
    }
    for previous, replacement in replacements.items():
        if previous not in text:
            raise ValueError(f"Expected source README statement not found: {previous}")
        text = text.replace(previous, replacement)
    text += "\n## Deployment / Déploiement\n\nRead [the bilingual deployment notes](DEPLOYMENT-NOTES.md) for shared image paths, unverified visual identities and the absence of mesh attachment. The deployed [provenance manifest](provenance-sha256.json) distinguishes unchanged source evidence from deployment-only link and documentation changes.\n"
    return text.encode("utf-8")


def deployed_html(source: bytes) -> bytes:
    text = source.decode("utf-8-sig")
    anchor = '<a href="README.md">Method and limitations</a>'
    if anchor not in text:
        raise ValueError("Standalone report navigation anchor changed")
    text = text.replace(anchor, anchor + '<a href="DEPLOYMENT-NOTES.md">Déploiement / Deployment</a><a href="provenance-sha256.json" download>Provenance SHA-256</a>')
    return text.encode("utf-8")


def package(source: Path, target: Path) -> dict:
    source, target = source.resolve(), target.resolve()
    data = json.loads((source / "survey-data.json").read_bytes())
    captures = data["captures"]
    expected = (len(captures), len({c["panorama_id"] for c in captures}), len(data["buildings"]))
    if expected != (55, 24, 22):
        raise ValueError(f"Unexpected source counts: {expected}")

    files = list(FIXED_FILES) + list(CONTEXT_IMAGES)
    for capture in captures:
        if not re.fullmatch(r"C\d{3}", capture["capture_id"]):
            raise ValueError("Unexpected capture ID")
        expected_image = f'evidence/{capture["capture_id"]}.jpg'
        if capture["screenshot"] != expected_image:
            raise ValueError(f"Unexpected original screenshot path: {capture['screenshot']}")
        files += [expected_image, f'evidence/{capture["capture_id"]}.txt']

    records, payload = [], {}
    for relative in sorted(set(files)):
        raw = confined(source, relative).read_bytes()
        content, transformation = raw, None
        if relative == "index.csv":
            content = shared_image_csv(raw)
            transformation = "building_screenshot paths now reference shared screenshot files; all other CSV field strings and all 120 rows are preserved"
        elif relative == "README.md":
            content = deployed_readme(raw)
            transformation = "shared-image deployment statements and bilingual deployment notes link"
        elif relative == "index.html":
            content = deployed_html(raw)
            transformation = "added deployment notes and provenance download links"
        elif relative == "coverage-map.svg":
            content = re.sub(rb'href="#(C\d{3})"', rb'href="index.html#\1"', raw)
            transformation = "standalone SVG capture links resolve to gallery anchors"
        payload[relative] = content
        records.append({"path": relative, "bytes": len(content), "sha256": sha256(content),
                        "source_path": relative, "source_sha256": sha256(raw),
                        "transformation": transformation})

    notes = DEPLOYMENT_NOTES.encode("utf-8")
    payload["DEPLOYMENT-NOTES.md"] = notes
    records.append({"path": "DEPLOYMENT-NOTES.md", "bytes": len(notes), "sha256": sha256(notes),
                    "source_path": None, "source_sha256": None,
                    "transformation": "deployment documentation; no source survey metadata changed"})
    provenance = {"schema_version": 1, "source_package": "streetview-survey-2026-11-15",
                  "survey_period": data.get("survey_date"),
                  "counts": {"captures": 55, "panoramas": 24, "visual_ids": 22, "index_rows": 120,
                             "nonempty_visual_associations": 116, "unassigned_captures": 4},
                  "source_json_unchanged": True, "original_evidence_unchanged": True,
                  "geometry_attachment": "NONE;ALL_VISUAL_IDENTITIES_UNVERIFIED",
                  "files": sorted(records, key=lambda record: record["path"])}
    payload["provenance-sha256.json"] = (json.dumps(provenance, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    checksums = "".join(f"{sha256(content)}  {relative}\n" for relative, content in sorted(payload.items()))
    payload["checksums.sha256"] = checksums.encode("utf-8")

    target.mkdir(parents=True, exist_ok=True)
    for relative, content in payload.items():
        destination = confined(target, relative)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    return {"files": len(payload), "bytes": sum(map(len, payload.values())),
            "captures": 55, "panoramas": 24, "visual_ids": 22, "index_rows": 120,
            "target": str(target)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--target", type=Path, default=DEFAULT_TARGET)
    args = parser.parse_args()
    print(json.dumps(package(args.source, args.target), ensure_ascii=False))
