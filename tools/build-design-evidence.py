#!/usr/bin/env python3
"""Build validated explicit facade records, preserving original survey captures."""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
FACADES = ROOT / 'preview-ycoor-design/design/facades'
GEOMETRY = ROOT / 'preview-ycoor-design/assets/ycoor-dxf.json'
SURVEY = ROOT / 'crans-montana-p06/assets/streetview-survey/2026-11-15/survey-data.json'
OUTPUT = ROOT / 'preview-ycoor-design/design/design-evidence.json'


def indexed(records: list[dict], key: str, kind: str) -> dict:
    result = {}
    for record in records:
        identifier = record.get(key)
        if not isinstance(identifier, str) or not identifier:
            raise ValueError(f'Missing {kind} ID ({key})')
        if identifier in result:
            raise ValueError(f'Duplicate {kind} ID: {identifier}')
        result[identifier] = record
    return result


def references(values: list, kind: str) -> list[str]:
    if not isinstance(values, list) or any(not isinstance(value, str) or not value for value in values):
        raise ValueError(f'Invalid {kind} references')
    if len(values) != len(set(values)):
        raise ValueError(f'Duplicate {kind} reference')
    return values


def ordered(records: dict, order: list, kind: str) -> list:
    references(order, f'{kind} order')
    missing = set(order) - set(records)
    omitted = set(records) - set(order)
    if missing or omitted:
        raise ValueError(f'Invalid {kind} order: missing records {sorted(missing)}, omitted IDs {sorted(omitted)}')
    return [records[identifier] for identifier in order]


def build_data(index: dict, facades: list[dict], geometry: dict, survey: dict) -> dict:
    """Join sources without modifying them or creating facade features."""
    buildings = indexed(geometry['buildings'], 'id', 'geometry building')
    survey_buildings = indexed(survey['buildings'], 'building_id', 'survey building')
    captures = indexed(survey['captures'], 'capture_id', 'capture')
    authored = indexed(facades, 'buildingId', 'authored building')
    building_order = ordered(authored, index['buildingOrder'], 'building')
    all_observations = []
    all_changes = []
    matches = []
    capture_ids = set()
    detail_ids = set()

    def use_captures(ids: list, building_id: str, survey_ids: list) -> None:
        for capture_id in references(ids, 'capture'):
            if capture_id not in captures:
                raise ValueError(f'Missing capture reference: {capture_id} ({building_id})')
            if not set(captures[capture_id].get('building_ids', [])) & set(survey_ids):
                raise ValueError(f'Invalid cross-building capture reference: {capture_id} ({building_id})')
            capture_ids.add(capture_id)

    def validate_owner(record: dict, building_id: str) -> None:
        if record.get('buildingId') != building_id:
            raise ValueError(f'Invalid cross-building record in {building_id}: {record.get("buildingId")}')
        face_id = record.get('faceId')
        if face_id is not None and (not isinstance(face_id, str) or not face_id.startswith(building_id + ':')):
            raise ValueError(f'Invalid cross-building face reference in {building_id}: {face_id}')

    for facade in building_order:
        building_id = facade['buildingId']
        if building_id not in buildings:
            raise ValueError(f'Missing geometry building: {building_id}')
        building = buildings[building_id]
        match = facade['match']
        required = {'surveyIds', 'status', 'evidenceIds', 'reason'}
        if set(match) != required:
            raise ValueError(f'Invalid match fields for building {building_id}; expected {sorted(required)}')
        survey_ids = references(match['surveyIds'], 'survey building')
        if not survey_ids:
            raise ValueError(f'Missing survey building references for {building_id}')
        for survey_id in survey_ids:
            if survey_id not in survey_buildings:
                raise ValueError(f'Missing survey building reference: {survey_id}')
        use_captures(match['evidenceIds'], building_id, survey_ids)
        matches.append(dict(buildingId=building_id, sourceUuid=building['sourceUuid'],
                            sourceDate=copy.deepcopy(building['sourceDate']), **copy.deepcopy(match)))
        for observation in facade['observations']:
            validate_owner(observation, building_id)
            use_captures(observation['captureIds'], building_id, survey_ids)
            all_observations.append(observation)
        for change in facade['changes']:
            validate_owner(change, building_id)
            use_captures(change['evidenceIds'], building_id, survey_ids)
            references(change['observationIds'], 'observation')
            for detail in change['details']:
                detail_id = detail.get('id')
                if not isinstance(detail_id, str) or not detail_id:
                    raise ValueError(f'Missing detail ID in {change.get("changeId")}')
                if detail_id in detail_ids:
                    raise ValueError(f'Duplicate detail ID: {detail_id}')
                detail_ids.add(detail_id)
                if 'buildingId' in detail and detail['buildingId'] != building_id:
                    raise ValueError(f'Invalid cross-building detail: {detail_id}')
                if 'faceId' in detail and detail['faceId'] != change.get('faceId'):
                    raise ValueError(f'Invalid cross-building detail face: {detail_id}')
                use_captures(detail['evidenceIds'], building_id, survey_ids)
            all_changes.append(change)

    observations = indexed(all_observations, 'observationId', 'observation')
    changes = indexed(all_changes, 'changeId', 'change')
    for change in all_changes:
        for observation_id in change['observationIds']:
            if observation_id not in observations:
                raise ValueError(f'Missing observation reference: {observation_id}')
            observation = observations[observation_id]
            if observation['buildingId'] != change['buildingId']:
                raise ValueError(f'Invalid cross-building observation reference: {observation_id}')
            if observation.get('faceId') != change.get('faceId'):
                raise ValueError(f'Invalid observation face reference: {observation_id}')
    return dict(schemaVersion=index['schemaVersion'], authoredAt=index['authoredAt'], policy=index['policy'],
                buildingMatches=matches,
                observations=copy.deepcopy(ordered(observations, index['observationOrder'], 'observation')),
                changes=copy.deepcopy(ordered(changes, index['changeOrder'], 'change')),
                captures=[copy.deepcopy(capture) for capture in survey['captures'] if capture['capture_id'] in capture_ids])


def read_json(path: Path) -> dict:
    return json.loads(path.read_bytes())


def load_data(folder: Path = FACADES) -> dict:
    facades = []
    for path in sorted(folder.glob('*.json')):
        if path.name == 'index.json':
            continue
        facade = read_json(path)
        if path.stem != facade.get('buildingId'):
            raise ValueError(f'Building ID must match its file name: {path.name}')
        facades.append(facade)
    return build_data(read_json(folder / 'index.json'), facades, read_json(GEOMETRY), read_json(SURVEY))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail when output is stale; do not write')
    parser.add_argument('--facades', type=Path, default=FACADES, help='Per-building authoring directory')
    parser.add_argument('--output', type=Path, default=OUTPUT, help='Generated evidence JSON')
    args = parser.parse_args()
    data = load_data(args.facades)
    document = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if not args.output.exists() or args.output.read_text(encoding='utf-8') != document:
            print('Design evidence is stale. Run: python tools/update-ycoor.py', file=sys.stderr)
            return 1
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(document.encode('utf-8'))
    count = sum(len(change['details']) for change in data['changes'])
    print(f'Design evidence {"is current" if args.check else "built"}: '
          f'{len(data["buildingMatches"])} matches, {len(data["observations"])} observations, {count} explicit details.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'Cannot build design evidence: {error}', file=sys.stderr)
        sys.exit(1)
