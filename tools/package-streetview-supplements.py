#!/usr/bin/env python3
"""Index supplementary browser captures without changing original evidence."""
import argparse
import csv
import hashlib
from html import escape
import io
import json
import math
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / 'crans-montana-p06/assets/streetview-survey/2026-11-15'


def outputs():
    sources = sorted(BASE.glob('supplement-*.json'))
    captures = [c for p in sources for c in json.loads(p.read_text(encoding='utf-8'))['captures']]
    ids = [c['capture_id'] for c in captures]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate supplementary capture ID')
    files = list(sources)
    for c in captures:
        path = (BASE / c['screenshot']).resolve()
        if not path.is_relative_to(BASE.resolve()) or not path.is_file():
            raise ValueError('Missing or unsafe screenshot: ' + c['screenshot'])
        files.append(path)
    columns = ['capture_id', 'building_ids', 'screenshot', 'panorama_id', 'latitude', 'longitude',
               'heading_deg', 'pitch_url_t', 'vertical_fov_url_y', 'imagery_date', 'provider',
               'streetview_url', 'captured_at_utc', 'metadata_status', 'gps_status', 'heading_status',
               'building_identity_status', 'capture_kind', 'notes']
    columns += sorted({key for c in captures for key in c} - set(columns))
    buf = io.StringIO(newline='')
    writer = csv.DictWriter(buf, fieldnames=columns, lineterminator='\r\n')
    writer.writeheader()
    for c in captures:
        writer.writerow({k: '|'.join(v) if isinstance(v, list) else v for k, v in c.items()})
    result = {'supplement-index.csv': buf.getvalue().encode('utf-8-sig')}
    # A camera-position diagram, not a map of surveyed building surfaces.
    points = {}
    for c in captures:
        lat, lon = float(c['latitude']), float(c['longitude'])
        if not math.isfinite(lat + lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError('Invalid camera coordinates')
        points.setdefault((lat, lon), []).append(c)
    if points:
        lat0 = sum(p[0] for p in points) / len(points)
        coslat = math.cos(math.radians(lat0))
        xs = [p[1] * coslat for p in points]
        ys = [p[0] for p in points]
        scale = min(700 / max(max(xs) - min(xs), 0.0001), 450 / max(max(ys) - min(ys), 0.0001))
        height = 660 + len(points) * 16
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="{height}" viewBox="0 0 1000 {height}">',
               f'<rect width="1000" height="{height}" fill="#faf8ef"/>',
               '<g font-family="sans-serif" fill="#24362f"><text x="35" y="38" font-size="22">Ycoor · points de vue complémentaires</text>',
               f'<text x="35" y="66">{len(captures)} captures · {len(points)} positions de caméra rapportées par Google</text>',
               '<text x="35" y="91">Schéma WGS84 approximatif · GPS physique et nord vrai non calibrés · pas de fond cadastral</text>',
               '<path d="M925 175v-45l-7 12m7-12 7 12" stroke="#24362f" fill="none"/><text x="919" y="120">N</text>']
        for i, ((lat, lon), group) in enumerate(points.items(), 1):
            x = 110 + (lon * coslat - min(xs)) * scale
            y = 145 + (max(ys) - lat) * scale
            labels = ', '.join(c['capture_id'] for c in group)
            svg.append(f'<a href="{escape(group[0]["screenshot"], quote=True)}"><title>{escape(labels)} · {lat}, {lon}</title><circle cx="{x:.2f}" cy="{y:.2f}" r="14" fill="#295a85"/><text x="{x:.2f}" y="{y+5:.2f}" text-anchor="middle" fill="white">{i}</text></a>')
            svg.append(f'<text x="35" y="{625+i*16}" font-size="12">{i} · {escape(labels)} · {lat}, {lon}</text>')
        svg += ['<text x="35" y="615" font-size="13">Positions de caméra seulement ; aucune surface cachée ni exhaustivité du relevé n’est déduite.</text>', '</g></svg>']
        result['supplement-map.svg'] = ('\n'.join(svg) + '\n').encode('utf-8')
    hashes = [(p.relative_to(BASE).as_posix(), hashlib.sha256(p.read_bytes()).hexdigest()) for p in set(files)]
    hashes += [(name, hashlib.sha256(value).hexdigest()) for name, value in result.items()]
    result['supplement-checksums.sha256'] = ''.join(f'{digest}  {name}\n' for name, digest in sorted(hashes)).encode()
    return result, len(captures)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    generated, count = outputs()
    for name, content in generated.items():
        path = BASE / name
        if args.check:
            if not path.is_file() or path.read_bytes() != content:
                raise SystemExit(name + ' is stale; run python tools/update-ycoor.py')
        else:
            path.write_bytes(content)
    print(f'Street View supplements: {count} captures, CSV, camera diagram and checksums ' + ('checked.' if args.check else 'updated.'))
