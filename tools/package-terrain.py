"""Crop the pinned official 2024 swissALTI3D 2 m rasters into the Ycoor grid.

Offline by default. Reads ../terrain-source-cache/catalog.json and the two source
GeoTIFFs. --download explicitly permits fetching missing cache files; it always
uses the pinned 2024 items and SHA-256 hashes below. --check compares without
writing. Requires Pillow for packaging only; the browser reads plain JSON.
"""
import argparse
import datetime
from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path
import sys
import urllib.request

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE = ROOT.parent / "terrain-source-cache"
DEFAULT_OUTPUT = ROOT / "preview-ycoor-design" / "assets" / "terrain-grid.json"
STAC_COLLECTION = "https://data.geo.admin.ch/api/stac/v1/collections/ch.swisstopo.swissalti3d"
MODEL_URL = "https://www.swisstopo.admin.ch/en/height-model-swissalti3d"
ORIGIN_E, ORIGIN_N = 2603036, 1128849
XS = list(range(-71, 72, 2))
ZS = list(range(-80, 91, 2))
PINNED = {
    "swissalti3d_2024_2602-1128": {
        "filename": "swissalti3d_2024_2602-1128_2_2056_5728.tif",
        "url": "https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_2024_2602-1128/swissalti3d_2024_2602-1128_2_2056_5728.tif",
        "sha256": "271f51f56a74af8f79f34a224253ff9d8c44fc0ac7072a6704aac39ec285e317",
        "left": 2602000, "top": 1129000,
    },
    "swissalti3d_2024_2603-1128": {
        "filename": "swissalti3d_2024_2603-1128_2_2056_5728.tif",
        "url": "https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_2024_2603-1128/swissalti3d_2024_2603-1128_2_2056_5728.tif",
        "sha256": "57814e33e3bb54e775776b3c09d104da38a359ed383069b8acb9d5267c9be0ac",
        "left": 2603000, "top": 1129000,
    },
}


@dataclass
class Tile:
    left: float
    top: float
    step: float
    width: int
    height: int
    values: object
    nodata: float

    def native_sample(self, e, n):
        """Return only exact PixelIsArea sample centres, never resample."""
        column = (e - self.left) / self.step - 0.5
        row = (self.top - n) / self.step - 0.5
        if not (math.isclose(column, round(column), abs_tol=1e-9, rel_tol=0)
                and math.isclose(row, round(row), abs_tol=1e-9, rel_tol=0)):
            return None
        column, row = round(column), round(row)
        if not (0 <= column < self.width and 0 <= row < self.height):
            return None
        value = float(self.values[row * self.width + column])
        if not math.isfinite(value) or value == self.nodata:
            raise ValueError(f"invalid height at E={e}, N={n}: {value}")
        return value


def verify_file(path, expected_sha256):
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    if actual != expected_sha256.lower():
        raise ValueError(f"SHA-256 mismatch for {path.name}: {actual}")
    return actual


def select_sources(catalog):
    """Require the exact reviewed 2024 assets, ignoring historical entries."""
    timestamp = catalog.get("timeStamp")
    if not isinstance(timestamp, str) or not timestamp.endswith("Z"):
        raise ValueError("cached catalogue needs its UTC timeStamp for retrieval provenance")
    datetime.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    selected = []
    for item_id, pin in PINNED.items():
        matches = [feature for feature in catalog.get("features", [])
                   if feature.get("id") == item_id]
        if len(matches) != 1:
            raise ValueError(f"catalogue must contain exactly one pinned item {item_id}")
        feature = matches[0]
        source_date = feature.get("properties", {}).get("datetime", "")
        if not source_date.startswith("2024-"):
            raise ValueError(f"unexpected source year for {item_id}")
        asset = feature.get("assets", {}).get(pin["filename"], {})
        if asset.get("file:checksum", "").lower() != "1220" + pin["sha256"]:
            raise ValueError(f"catalogue does not match pinned checksum for {item_id}")
        if (asset.get("href") != pin["url"] or asset.get("gsd") != 2
                or asset.get("proj:epsg") != 2056):
            raise ValueError(f"unexpected source URL, spacing or CRS for {item_id}")
        selected.append((item_id, pin, feature, asset))
    return selected


def geokey(tags, key):
    directory = tags.get(34735, ())
    if len(directory) < 4:
        return None
    for offset in range(4, len(directory), 4):
        code, location, count, value = directory[offset:offset + 4]
        if code == key and location == 0 and count == 1:
            return value
    return None


def read_tile(path, pin):
    """Read the verified native float raster and validate its half-cell geometry."""
    verify_file(path, pin["sha256"])
    with Image.open(path) as image:
        tags = image.tag_v2
        scale = tuple(tags.get(33550, ()))
        tiepoint = tuple(tags.get(33922, ()))
        if image.mode != "F" or image.size != (500, 500):
            raise ValueError(f"unexpected raster data type or dimensions: {path.name}")
        if scale != (2.0, 2.0, 0.0):
            raise ValueError(f"expected native 2 m raster: {path.name}")
        if tiepoint != (0.0, 0.0, 0.0, pin["left"], pin["top"], 0.0):
            raise ValueError(f"unexpected raster origin: {path.name}")
        if geokey(tags, 1025) != 1 or geokey(tags, 3072) != 2056:
            raise ValueError(f"expected PixelIsArea and EPSG:2056: {path.name}")
        try:
            nodata = float(str(tags[42113]).strip("\0 "))
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"missing or invalid NoData declaration: {path.name}") from error
        pixels = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        return Tile(pin["left"], pin["top"], 2, image.width, image.height,
                    list(pixels), nodata)


def crop_native_grid(tiles, xs, zs, origin_e, origin_n):
    rows = []
    for z in zs:
        row = []
        for x in xs:
            e, n = origin_e + x, origin_n - z
            matches = [height for tile in tiles
                       if (height := tile.native_sample(e, n)) is not None]
            if len(matches) != 1:
                raise ValueError(f"expected exactly one native sample at E={e}, N={n}; got {len(matches)}")
            row.append(matches[0])
        rows.append(row)
    return rows


def centre_height(xs, zs, rows):
    """The origin lies between the two x sample centres on native z=0."""
    if 0 not in zs:
        raise ValueError("centre interpolation requires a native z=0 row")
    for index, (left, right) in enumerate(zip(xs, xs[1:])):
        if left < 0 < right:
            row = rows[zs.index(0)]
            fraction = -left / (right - left)
            return row[index] * (1 - fraction) + row[index + 1] * fraction
    raise ValueError("native x samples must bracket the centre")


def download_missing(cache):
    """Fetch only missing files from the pinned source, never select 'latest'."""
    cache.mkdir(parents=True, exist_ok=True)
    catalog_path = cache / "catalog.json"
    if not catalog_path.exists():
        features = []
        for item_id in PINNED:
            with urllib.request.urlopen(f"{STAC_COLLECTION}/items/{item_id}", timeout=60) as response:
                features.append(json.load(response))
        catalog = {"type": "FeatureCollection",
                   "timeStamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
                   "features": features}
        select_sources(catalog)
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    for _item_id, pin, _feature, _asset in select_sources(catalog):
        path = cache / pin["filename"]
        if not path.exists():
            with urllib.request.urlopen(pin["url"], timeout=120) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != pin["sha256"]:
                raise ValueError(f"downloaded SHA-256 mismatch for {path.name}")
            path.write_bytes(data)


def package(cache):
    catalog_path = cache / "catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    selected = select_sources(catalog)
    tiles = [read_tile(cache / pin["filename"], pin) for _item_id, pin, _feature, _asset in selected]
    native_rows = crop_native_grid(tiles, XS, ZS, ORIGIN_E, ORIGIN_N)
    sources = []
    for item_id, pin, feature, asset in selected:
        sources.append({
            "itemId": item_id, "sourceYear": 2024,
            "stacItemUrl": f"{STAC_COLLECTION}/items/{item_id}",
            "stacDatetime": feature["properties"]["datetime"],
            "assetUrl": pin["url"], "fileName": pin["filename"],
            "fileChecksum": asset["file:checksum"], "sha256": pin["sha256"],
            "bytes": (cache / pin["filename"]).stat().st_size,
        })
    return {
        "schemaVersion": 2, "provider": "Federal Office of Topography swisstopo",
        "model": "swissALTI3D", "modelUrl": MODEL_URL, "sourceYear": 2024,
        "crs": "EPSG:2056", "verticalCrs": "EPSG:5728", "verticalDatum": "LN02",
        "units": "metres", "origin": {"e": ORIGIN_E, "n": ORIGIN_N},
        "coordinateMapping": "E=origin.e+x; N=origin.n-z; height=absolute LN02 H",
        "observationDate": None,
        "sourceDateNotice": "2024 is the STAC item year. The exact acquisition day is not established; STAC datetime 2024-01-01 is not asserted to be an observation date.",
        "retrievedAt": catalog["timeStamp"],
        "retrievedAtBasis": "UTC timeStamp retained from the cached STAC response, not regenerated during packaging or --check.",
        "catalogue": {"sha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
                      "collectionUrl": STAC_COLLECTION,
                      "selection": "Exactly the two pinned 2024 2 m LV95/LN02 assets; 2019 catalogue entries ignored."},
        "sources": sources,
        "gridStep": 2, "columns": len(XS), "rows": len(ZS),
        "rasterRegistration": "PixelIsArea; first sample is half a native pixel east and south of the GeoTIFF upper-left tiepoint.",
        "sampleExtent": {"minE": ORIGIN_E + XS[0], "maxE": ORIGIN_E + XS[-1],
                         "minN": ORIGIN_N - ZS[-1], "maxN": ORIGIN_N - ZS[0]},
        "heightEncoding": "Native float32 heights rounded to 0.001 m for JSON; at most 0.0005 m rounding error. No terrain resampling, smoothing, gap filling or synthetic samples.",
        "heightPrecision": 0.001,
        "centreHeight": round(centre_height(XS, ZS, native_rows), 3),
        "centreHeightMethod": "Linear interpolation at x=0,z=0 between native samples x=-1 and x=1 on the z=0 row, then rounded to 0.001 m; not a native sample.",
        "xs": XS, "zs": ZS,
        "heights": [[round(value, 3) for value in row] for row in native_rows],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--download", action="store_true", help="explicitly download missing pinned cache files")
    parser.add_argument("--check", action="store_true", help="verify existing output without writing")
    args = parser.parse_args()
    if args.check and args.download:
        parser.error("--check is offline; use --download separately to populate the cache")
    try:
        if args.download:
            download_missing(args.cache)
        result = package(args.cache)
        encoded = json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
        if args.check:
            if not args.output.exists() or args.output.read_text(encoding="utf-8") != encoded:
                raise ValueError(f"terrain grid is missing or differs: {args.output}")
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(encoded, encoding="utf-8", newline="\n")
    except (OSError, ValueError, KeyError) as error:
        print(f"Terrain packaging failed: {error}", file=sys.stderr)
        return 1
    action = "Checked" if args.check else "Packaged"
    flat = [height for row in result["heights"] for height in row]
    print(f"{action} {result['columns']} x {result['rows']} native terrain samples at 2 m; "
          f"H={min(flat):.3f}..{max(flat):.3f} m LN02; centre={result['centreHeight']:.3f} m.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
