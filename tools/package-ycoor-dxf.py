"""Package the six audited pilot polyfaces without coordinate rounding or rescaling.

Usage: python tools/package-ycoor-dxf.py [--fetch-terrain]
Offline default preserves an existing official height snapshot. The source DXF ZIP
and audit remain outside the repository. CAD handles are file-local, not cadastral IDs.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT.parent / 'input-comparison-2026-11-16'
OUT = ROOT / 'preview-ycoor-design' / 'assets'
STEM = 'swissbuildings3d_2_2024-05_1287-13_2056_5728'


def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


def fetch_height(offset):
    x, z = offset
    e, n = 2603036 + x, 1128849 - z
    url = f'https://api3.geo.admin.ch/rest/services/height?easting={e}&northing={n}&sr=2056'
    with urllib.request.urlopen(url, timeout=45) as response:
        raw = json.loads(response.read())
    return {'x': x, 'z': z, 'e': e, 'n': n, 'height': float(raw['height']), 'raw': raw, 'url': url,
            'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch-terrain', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    audit_path = INPUT / f'{STEM}-audit.json'
    audit = json.loads(audit_path.read_text(encoding='utf-8'))
    comparison = json.loads((INPUT / 'geometry-comparison.json').read_text(encoding='utf-8'))
    stac = json.loads((INPUT / 'stac-1287-13.json').read_text(encoding='utf-8'))
    matches = {m['dxf_handle']: m for m in comparison['matches']}
    selected = sorted((b for b in audit['nearby_objects'] if b['pilot_bbox_intersection']), key=lambda b: b['cad_handle'])
    assert len(selected) == 6
    buildings = []
    for b in selected:
        m = matches[b['cad_handle']]
        buildings.append({'id': b['cad_handle'], 'sourceUuid': m['streamed_uuid'],
                          'sourceDate': {'year': m['origin_year'], 'month': m['origin_month']},
                          'type': b['layer'], 'sourceTile': m['streamed_tile'],
                          'vertices': b['vertices'], 'faces': b['faces'], 'bounds': b['bounds']})
    write('ycoor-dxf.json', {'schemaVersion': 1, 'crs': 'EPSG:2056', 'verticalDatum': 'LN02',
                           'coordinateUnits': 'metres', 'origin': {'e': 2603036, 'n': 1128849},
                           'pilotBbox': audit['pilot_bbox'], 'buildings': buildings})
    archive = ROOT.parent / f'{STEM}.dxf.zip'
    if archive.exists():
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == audit['archive_sha256'], 'Source archive hash differs'
    write('dxf-provenance.json', {
        'dataset': 'swissBUILDINGS3D 2.0', 'sourceRelease': '2024-05',
        'identityNotice': 'CAD handles identify source DXF objects only, not cadastral building IDs. Streamed UUID associations are geometric matches, not cadastral identity verification.',
        'coordinateHandling': 'Absolute LV95 E,N and LN02 H metres retained verbatim from audited DXF vertices; no rescaling despite $INSUNITS=1; full volumes retained on bbox intersection.',
        'archive': {k: audit[k] for k in ['archive','archive_bytes','archive_sha256','member','dxf_bytes','dxf_sha256','zip_member_timestamp_timezone_unavailable','headers']},
        'auditSha256': hashlib.sha256(audit_path.read_bytes()).hexdigest(),
        'stac': stac, 'geometryMatchMethod': comparison['method'],
        'geometryMatches': [matches[b['id']] for b in buildings],
        'selection': {'method': 'pilot_bbox_intersection == true', 'bbox': audit['pilot_bbox'], 'count': len(buildings)}})
    if args.fetch_terrain:
        offsets = [(x, z) for z in [-50, 0, 50] for x in [-50, 0, 50]]
        with concurrent.futures.ThreadPoolExecutor(max_workers=9) as pool:
            samples = list(pool.map(fetch_height, offsets))
        write('terrain-snapshot.json', {'schemaVersion': 1, 'provider': 'Swiss Confederation geo.admin.ch official height service',
              'crs': 'EPSG:2056', 'units': 'metres', 'origin': {'e':2603036,'n':1128849},
              'observationDate': None, 'model': None, 'verticalDatum': None,
              'unknownMetadataNotice': 'API response does not identify observation date, elevation model or vertical datum.',
              'centreHeight': next(s['height'] for s in samples if s['x']==s['z']==0), 'samples': samples})
    print(f'Packaged {len(buildings)} full buildings, {sum(len(b["faces"]) for b in buildings)} triangles.')


if __name__ == '__main__':
    main()
