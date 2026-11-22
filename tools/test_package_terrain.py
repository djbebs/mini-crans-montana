"""Tests of native raster positioning and evidence checks (no network)."""
import importlib.util
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "package_terrain", Path(__file__).with_name("package-terrain.py"))
terrain = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = terrain
SPEC.loader.exec_module(terrain)


class NativeGridTests(unittest.TestCase):
    def tile(self, left=2603000, values=(1, 2, 3, 4)):
        return terrain.Tile(left, 1129000, 2, 2, 2, values, -9999)

    def test_pixel_is_area_uses_half_cell_centres(self):
        tile = self.tile()
        self.assertEqual(tile.native_sample(2603001, 1128999), 1)
        self.assertEqual(tile.native_sample(2603003, 1128999), 2)
        self.assertIsNone(tile.native_sample(2603000, 1129000))
        self.assertIsNone(tile.native_sample(2603002, 1128999))

    def test_northing_decreases_as_raster_row_increases(self):
        tile = self.tile()
        self.assertEqual(tile.native_sample(2603001, 1128997), 3)
        self.assertIsNone(tile.native_sample(2603001, 1129001))

    def test_native_crop_crosses_tile_seam_without_resampling(self):
        west = self.tile(2602996, (1, 2, 5, 6))
        east = self.tile(2603000, (3, 4, 7, 8))
        rows = terrain.crop_native_grid(
            [west, east], [-3, -1, 1, 3], [0, 2], 2603000, 1128999)
        self.assertEqual(rows, [[1, 2, 3, 4], [5, 6, 7, 8]])

    def test_gaps_and_overlaps_are_rejected(self):
        tile = self.tile()
        with self.assertRaisesRegex(ValueError, "exactly one"):
            terrain.crop_native_grid([tile], [0], [0], 2603000, 1128999)
        with self.assertRaisesRegex(ValueError, "exactly one"):
            terrain.crop_native_grid([tile, tile], [1], [0], 2603000, 1128999)

    def test_nodata_and_nonfinite_samples_are_rejected(self):
        for invalid in (-9999, math.nan, math.inf):
            with self.subTest(invalid=invalid):
                with self.assertRaisesRegex(ValueError, "invalid height"):
                    terrain.crop_native_grid(
                        [self.tile(values=(invalid, 2, 3, 4))],
                        [1], [0], 2603000, 1128999)

    def test_centre_is_interpolated_without_adding_a_native_sample(self):
        self.assertEqual(terrain.centre_height([-1, 1], [0, 2], [[10, 14], [20, 24]]), 12)
        with self.assertRaisesRegex(ValueError, "bracket"):
            terrain.centre_height([1, 3], [0, 2], [[10, 14], [20, 24]])


class ProvenanceTests(unittest.TestCase):
    def test_hash_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "tile.tif"
            source.write_bytes(b"modified terrain")
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                terrain.verify_file(source, "0" * 64)

    def test_catalogue_requires_pinned_2024_items_and_checksums(self):
        features = []
        for item_id, pin in terrain.PINNED.items():
            features.append({
                "id": item_id, "properties": {"datetime": "2024-01-01T00:00:00Z"},
                "assets": {pin["filename"]: {
                    "href": pin["url"], "gsd": 2, "proj:epsg": 2056,
                    "file:checksum": "1220" + pin["sha256"].upper()}}})
        features.append({"id": "swissalti3d_2019_2602-1128"})
        catalog = {"features": features, "timeStamp": "2026-11-22T16:17:43Z"}
        self.assertEqual(len(terrain.select_sources(catalog)), 2)
        altered = json.loads(json.dumps(catalog))
        first_asset = next(iter(altered["features"][0]["assets"].values()))
        first_asset["file:checksum"] = "1220" + "0" * 64
        with self.assertRaisesRegex(ValueError, "pinned checksum"):
            terrain.select_sources(altered)


if __name__ == "__main__":
    unittest.main()
