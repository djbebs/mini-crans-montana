#!/usr/bin/env python3
"""Validate the playground references and maintain their separate CSV index."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'preview-ycoor-design/assets/playground-evidence/2026-11-23'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = json.loads((BASE / 'references.json').read_text(encoding='utf-8'))
    rows = []
    fields = ['evidence_id', 'provider', 'imagery_label', 'latitude', 'longitude',
              'heading_deg', 'vertical_fov_deg', 'physical_pose_status', 'captured_at',
              'screenshot', 'source_url', 'sha256', 'notes']
    for capture in data['captures']:
        path = (BASE / capture['screenshot']).resolve()
        if not path.is_relative_to(BASE) or not path.is_file():
            raise ValueError('Missing or invalid screenshot path')
        if hashlib.sha256(path.read_bytes()).hexdigest() != capture['sha256']:
            raise ValueError('Screenshot checksum mismatch: ' + capture['capture_id'])
        match = re.search(r'@([\d.]+),([\d.]+),[^,]+,([\d.]+)y,([\d.]+)h,', capture['streetview_url'])
        if not match or match.groups() != tuple(capture[k] for k in ['latitude', 'longitude', 'vertical_fov_deg', 'heading_deg']):
            raise ValueError('Capture pose differs from its URL: ' + capture['capture_id'])
        rows.append(dict(evidence_id=capture['capture_id'], provider=capture['provider'],
                         imagery_label=capture['imagery_date'], latitude=capture['latitude'],
                         longitude=capture['longitude'], heading_deg=capture['heading_deg'],
                         vertical_fov_deg=capture['vertical_fov_deg'], physical_pose_status=capture['pose_status'],
                         captured_at=capture['captured_at'], screenshot=capture['screenshot'],
                         source_url=capture['streetview_url'], sha256=capture['sha256'], notes=capture['notes']))
    for photo in data['photographs']:
        rows.append(dict(evidence_id=photo['evidence_id'], provider=photo['credit'],
                         imagery_label=str(photo['year_label']) + ' (label; exact acquisition unverified)',
                         physical_pose_status='UNAVAILABLE', source_url=photo['source_url'],
                         notes=photo['date_status']))
    if len({r['evidence_id'] for r in rows}) != len(rows):
        raise ValueError('Duplicate playground evidence ID')
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    output = BASE / 'index.csv'
    expected = stream.getvalue()
    if args.check:
        if not output.exists() or output.read_text(encoding='utf-8') != expected:
            raise ValueError('Playground CSV is stale; run tools/update-ycoor.py')
    else:
        output.write_text(expected, encoding='utf-8', newline='')
    print(f'Playground evidence: {len(data["captures"])} panorama captures and {len(data["photographs"])} photo references verified; CSV current.')


if __name__ == '__main__':
    main()
