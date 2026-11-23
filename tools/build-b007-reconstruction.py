#!/usr/bin/env python3
"""Build a separately labelled photographic model on the unchanged DXF footprint."""
import argparse
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / 'preview-ycoor-design/design'


def build():
    spec = json.loads((DESIGN / 'reconstructions/26152.json').read_text(encoding='utf-8'))
    original = json.loads((DESIGN.parent / 'assets/ycoor-dxf.json').read_text(encoding='utf-8'))
    source = next(b for b in original['buildings'] if b['id'] == spec['buildingId'])
    assert source['sourceUuid'] == spec['referenceSourceUuid']
    if spec['referenceSourceGeometry'] != {key: source[key] for key in ('vertices', 'faces')}:
        raise ValueError('Official source changed; review the photographic interpretation before rebuilding it.')
    anchor, along = spec['anchor'], spec['along']
    length = math.hypot(*along)
    axis = [v / length for v in along]
    bottom = source['bounds'][2]
    top = source['bounds'][5]
    eaves, ridge = spec['estimatedEavesHeight'], spec['estimatedRidgeHeight']
    cuts = [i * length / 6 for i in range(7)]

    def u(point):
        return (point[0] - anchor[0]) * axis[0] + (point[1] - anchor[1]) * axis[1]

    def clip(polygon, limit, greater):
        result = []
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
            da, db = u(a) - limit, u(b) - limit
            inside_a, inside_b = da >= -1e-9 if greater else da <= 1e-9, db >= -1e-9 if greater else db <= 1e-9
            if inside_a:
                result.append(a)
            if inside_a != inside_b:
                t = da / (da - db)
                result.append([a[j] + t * (b[j] - a[j]) for j in range(3)])
        return result

    def adjusted(point):
        x = max(0, min(6, u(point) * 6 / length))
        segment = min(5, int(x))
        h0, h1 = (eaves, ridge) if segment % 2 == 0 else (ridge, eaves)
        roof = h0 + (h1 - h0) * (x - segment)
        return [round(point[0], 6), round(point[1], 6), round(bottom + (point[2] - bottom) / (top - bottom) * (roof - bottom), 6)]

    vertices, faces, lookup = [], [], {}
    for triangle in source['faces']:
        for left, right in zip(cuts, cuts[1:]):
            polygon = clip(clip([source['vertices'][i] for i in triangle], left, True), right, False)
            ids = []
            for point in polygon:
                p = adjusted(point)
                key = tuple(p)
                if key not in lookup:
                    lookup[key] = len(vertices)
                    vertices.append(p)
                ids.append(lookup[key])
            for i in range(1, len(ids) - 1):
                face = [ids[0], ids[i], ids[i + 1]]
                a, b, c = [vertices[j] for j in face]
                ab, ac = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
                area = math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])
                if len(set(face)) == 3 and area > 1e-7:
                    faces.append(face)
    bounds = [min(p[k] for p in vertices) for k in range(3)] + [max(p[k] for p in vertices) for k in range(3)]
    building = dict(id=spec['buildingId'], sourceUuid=None, sourceDate=None, sourceTile=None,
                    type='PHOTO_RECONSTRUCTION_ESTIMATED', vertices=vertices, faces=faces, bounds=bounds)
    module_spec = importlib.util.spec_from_file_location('evidence_builder', ROOT / 'tools/build-design-evidence.py')
    builder = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(builder)
    library = json.loads((DESIGN / 'detail-templates.json').read_text(encoding='utf-8'))
    library.update(spec.pop('styles'))
    for facade in spec['facades']:
        facade['details'] = [builder.expand_detail(detail, library) for detail in facade['details']]
    spec['sourceBounds'] = source['bounds']
    spec['geometry'] = dict(origin=original['origin'], buildings=[building])
    return json.dumps(spec, ensure_ascii=False, indent=2) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    output = DESIGN / 'photo-reconstruction.json'
    text = build()
    if args.check:
        if not output.exists() or output.read_text(encoding='utf-8') != text:
            raise SystemExit('Photographic reconstruction is stale; run python tools/update-ycoor.py')
    else:
        output.write_text(text, encoding='utf-8')
    print('B007 photographic reconstruction ' + ('checked.' if args.check else 'built; all heights explicitly estimated.'))
