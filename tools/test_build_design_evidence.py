"""Regression tests for explicit facade authoring and immutable source joins."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / 'tools/build-design-evidence.py'
FACADES = ROOT / 'preview-ycoor-design/design/facades'
TEMPLATES = FACADES.with_name('detail-templates.json')
EVIDENCE = ROOT / 'preview-ycoor-design/design/design-evidence.json'
GEOMETRY = ROOT / 'preview-ycoor-design/assets/ycoor-dxf.json'
SURVEY = ROOT / 'crans-montana-p06/assets/streetview-survey/2026-11-15/survey-data.json'


def read(path):
    return json.loads(path.read_bytes())


class BuildDesignEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(BUILDER.exists(), 'The validated per-building evidence builder is missing')
        spec = importlib.util.spec_from_file_location('build_design_evidence', BUILDER)
        self.builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.builder)
        self.index = read(FACADES / 'index.json')
        self.facades = [read(path) for path in sorted(FACADES.glob('*.json')) if path.name != 'index.json']
        self.templates = read(TEMPLATES) if TEMPLATES.exists() else {}
        self.geometry = read(GEOMETRY)
        self.survey = read(SURVEY)
        for path in sorted(SURVEY.parent.glob('supplement-*.json')):
            self.survey['captures'].extend(read(path)['captures'])

    def build(self):
        return self.builder.build_data(self.index, self.facades, self.geometry, self.survey, self.templates)

    def facade(self, building_id):
        return next(item for item in self.facades if item['buildingId'] == building_id)

    def test_expanded_records_and_order_are_preserved_byte_for_byte(self):
        expanded = self.builder.load_data()
        document = json.dumps(expanded, ensure_ascii=False, indent=2) + '\n'
        self.assertEqual(EVIDENCE.read_bytes().replace(b'\r\n', b'\n'), document.encode('utf-8'))

    def use_test_template(self):
        details = self.facade('2355E')['changes'][0]['details']
        instance = {key: details[0][key] for key in ('id', 'u', 'v', 'label', 'evidenceIds')}
        instance['template'] = 'test-opening'
        self.templates['test-opening'] = {
            'kind': 'window', 'width': 1.2, 'height': 0.9, 'color': '#223344',
            'frame': {'width': 0.08, 'color': '#765432'},
        }
        details[0] = instance
        return instance

    def test_template_expands_with_explicit_overrides_and_metadata(self):
        instance = self.use_test_template()
        instance['height'] = 1.4
        instance['frame'] = {'width': 0.1, 'color': '#456789'}
        instance['status'] = 'observed'
        snapshot = copy.deepcopy((self.facades, self.templates))
        actual = next(detail for change in self.build()['changes'] for detail in change['details']
                      if detail['id'] == instance['id'])
        self.assertEqual({
            'id': instance['id'], 'u': instance['u'], 'v': instance['v'],
            'label': instance['label'], 'evidenceIds': instance['evidenceIds'],
            'kind': 'window', 'width': 1.2, 'height': 1.4, 'color': '#223344',
            'frame': {'width': 0.1, 'color': '#456789'}, 'status': 'observed',
        }, actual)
        self.assertEqual(snapshot, (self.facades, self.templates))

    def test_unknown_or_invalid_template_references_are_rejected(self):
        instance = self.use_test_template()
        for name in ('missing-template', '../test-opening', '__proto__', ['test-opening']):
            with self.subTest(name=name):
                instance['template'] = name
                with self.assertRaisesRegex(ValueError, 'template'):
                    self.build()

    def test_template_library_cannot_supply_metadata_or_reference_other_templates(self):
        self.use_test_template()
        template = self.templates['test-opening']
        for field in ('id', 'buildingId', 'faceId', 'u', 'v', 'evidenceIds', 'label', 'status', 'template'):
            with self.subTest(field=field):
                template[field] = 'unexpected'
                with self.assertRaisesRegex(ValueError, f'template.*{field}'):
                    self.build()
                del template[field]
        template['frame']['status'] = 'unexpected'
        with self.assertRaisesRegex(ValueError, 'template.*status'):
            self.build()

    def test_templated_details_require_explicit_placement_label_and_evidence(self):
        instance = self.use_test_template()
        for field in ('id', 'u', 'v', 'label', 'evidenceIds'):
            with self.subTest(field=field):
                value = instance.pop(field)
                with self.assertRaisesRegex(ValueError, field):
                    self.build()
                instance[field] = value
        instance['evidenceIds'] = []
        with self.assertRaisesRegex(ValueError, 'evidenceIds'):
            self.build()

    def test_captures_remain_original_including_nulls_and_strings(self):
        # A future imported capture may contain nulls; never coerce source values.
        self.survey['captures'].append(dict(capture_id='C999', building_ids=['B002'],
                                            heading_deg='090.00', imagery_date=None))
        self.facade('2355E')['match']['evidenceIds'].append('C999')
        original = {item['capture_id']: item for item in self.survey['captures']}
        actual = self.build()['captures']
        self.assertTrue(any(any(value is None for value in item.values()) for item in actual))
        self.assertTrue(any(isinstance(item.get('heading_deg'), str) for item in actual))
        for item in actual:
            self.assertEqual(original[item['capture_id']], item)
        snapshot = copy.deepcopy(self.survey)
        self.build()
        self.assertEqual(snapshot, self.survey)

    def write_load_fixture(self, directory, supplements):
        folder = directory / 'facades'
        folder.mkdir()
        (folder / 'index.json').write_text(json.dumps(self.index), encoding='utf-8')
        for facade in self.facades:
            (folder / f'{facade["buildingId"]}.json').write_text(json.dumps(facade), encoding='utf-8')
        (directory / 'detail-templates.json').write_text(json.dumps(self.templates), encoding='utf-8')
        self.builder.SURVEY = directory / 'survey-data.json'
        self.builder.SURVEY.write_bytes(SURVEY.read_bytes())
        for path in SURVEY.parent.glob('supplement-*.json'):
            (directory / path.name).write_bytes(path.read_bytes())
        for name, captures in supplements.items():
            (directory / name).write_text(json.dumps({'captures': captures}), encoding='utf-8')
        return folder

    def test_load_data_merges_supplementary_captures_and_preserves_every_source_value(self):
        captures = [dict(capture_id='C998', building_ids=['B002'], heading_deg='090.00',
                         imagery_date=None, screenshot='evidence/2026-11-21/B003-N001.jpg',
                         extra_metadata={'untouched': ['001', None, 0]}),
                    dict(capture_id='C999', building_ids=['B002'], heading_deg=None,
                         imagery_date='Jun 2024')]
        self.facade('2355E')['match']['evidenceIds'].extend(['C998', 'C999'])
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            folder = self.write_load_fixture(directory, {
                'supplement-b.json': [captures[1]], 'supplement-a.json': [captures[0]],
            })
            (directory / 'unrelated.json').write_text('not a survey supplement', encoding='utf-8')
            snapshots = {path: path.read_bytes() for path in directory.glob('*.json')}
            actual = self.builder.load_data(folder)['captures']
            self.assertEqual(captures, actual[-2:])
            original = {item['capture_id']: item for item in self.survey['captures']}
            for item in actual[:-2]:
                self.assertEqual(original[item['capture_id']], item)
            self.assertEqual(snapshots, {path: path.read_bytes() for path in snapshots})

    def test_load_data_rejects_capture_ids_repeated_across_source_files(self):
        original_capture = copy.deepcopy(self.survey['captures'][0])
        new_capture = dict(capture_id='C-NEW', building_ids=['B002'])
        for supplements, duplicate_id in [
            ({'supplement-a.json': [original_capture]}, original_capture['capture_id']),
            ({'supplement-a.json': [new_capture], 'supplement-b.json': [new_capture]}, 'C-NEW'),
        ]:
            with self.subTest(duplicate_id=duplicate_id), tempfile.TemporaryDirectory() as temporary:
                folder = self.write_load_fixture(Path(temporary), supplements)
                with self.assertRaisesRegex(ValueError, f'Duplicate capture ID: {duplicate_id}'):
                    self.builder.load_data(folder)

    def test_uuid_and_date_are_joined_from_geometry(self):
        building_id = self.index['buildingOrder'][0]
        building = next(item for item in self.geometry['buildings'] if item['id'] == building_id)
        building['sourceUuid'] = 'source-value'
        building['sourceDate'] = {'year': 1999, 'month': None}
        match = self.build()['buildingMatches'][0]
        self.assertEqual('source-value', match['sourceUuid'])
        self.assertEqual({'year': 1999, 'month': None}, match['sourceDate'])

    def test_collects_change_and_detail_only_capture_references(self):
        change = self.facade('2355E')['changes'][0]
        for capture_id, destination in [('C998', change), ('C999', change['details'][0])]:
            self.survey['captures'].append(dict(capture_id=capture_id, building_ids=['B002'], heading_deg=None))
            destination['evidenceIds'].append(capture_id)
        self.assertEqual(['C998', 'C999'], [item['capture_id'] for item in self.build()['captures'][-2:]])

    def test_missing_capture_is_rejected_at_every_reference_level(self):
        facade = self.facade('2355E')
        for record, key in [(facade['match'], 'evidenceIds'), (facade['observations'][0], 'captureIds'),
                            (facade['changes'][0], 'evidenceIds'), (facade['changes'][0]['details'][0], 'evidenceIds')]:
            with self.subTest(key=key, record=record.get('id')):
                record[key].append('C-MISSING')
                with self.assertRaisesRegex(ValueError, 'capture.*C-MISSING'):
                    self.build()
                record[key].pop()

    def test_capture_for_an_unrelated_survey_building_is_rejected(self):
        self.survey['captures'].append(dict(capture_id='C999', building_ids=['B001']))
        self.facade('2355E')['match']['evidenceIds'].append('C999')
        with self.assertRaisesRegex(ValueError, 'cross-building.*C999'):
            self.build()

    def test_cross_building_records_and_faces_are_rejected(self):
        record = self.facade('2355E')['observations'][0]
        for key, value in [('buildingId', '2997D'), ('faceId', '2997D:wall:002')]:
            with self.subTest(key=key):
                before = record[key]
                record[key] = value
                with self.assertRaisesRegex(ValueError, 'cross-building'):
                    self.build()
                record[key] = before

    def test_cross_building_observation_link_is_rejected(self):
        self.facade('2355E')['changes'][0]['observationIds'].append('OBS-RAWYL-2024')
        with self.assertRaisesRegex(ValueError, 'cross-building.*OBS-RAWYL-2024'):
            self.build()

    def test_dangling_observation_link_is_rejected(self):
        self.facade('2355E')['changes'][0]['observationIds'].append('OBS-MISSING')
        with self.assertRaisesRegex(ValueError, 'observation.*OBS-MISSING'):
            self.build()

    def test_duplicate_record_ids_are_rejected(self):
        for collection in ['observations', 'changes']:
            with self.subTest(collection=collection):
                records = self.facade('2355E')[collection]
                records.append(copy.deepcopy(records[0]))
                with self.assertRaisesRegex(ValueError, 'Duplicate'):
                    self.build()
                records.pop()
        details = self.facade('2355E')['changes'][0]['details']
        details.append(copy.deepcopy(details[0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate.*detail'):
            self.build()

    def test_duplicate_source_and_building_ids_are_rejected(self):
        for collection in [self.facades, self.geometry['buildings'], self.survey['captures']]:
            with self.subTest(kind=list(collection[0])):
                collection.append(copy.deepcopy(collection[0]))
                with self.assertRaisesRegex(ValueError, 'Duplicate'):
                    self.build()
                collection.pop()

    def test_dangling_or_duplicate_order_entries_are_rejected(self):
        for key in ['buildingOrder', 'observationOrder', 'changeOrder']:
            for extra in [self.index[key][0], 'MISSING']:
                with self.subTest(key=key, extra=extra):
                    self.index[key].append(extra)
                    with self.assertRaises(ValueError):
                        self.build()
                    self.index[key].pop()

    def test_missing_geometry_and_survey_building_are_rejected(self):
        building = self.geometry['buildings'].pop(0)
        with self.assertRaisesRegex(ValueError, 'building'):
            self.build()
        self.geometry['buildings'].insert(0, building)
        self.facade('2355E')['match']['surveyIds'].append('B-MISSING')
        with self.assertRaisesRegex(ValueError, 'survey.*B-MISSING'):
            self.build()

    def test_check_detects_stale_output_without_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'design-evidence.json'
            target.write_text('{"stale": true}\n', encoding='utf-8')
            command = [sys.executable, str(BUILDER), '--output', str(target)]
            result = subprocess.run(command + ['--check'], capture_output=True, text=True)
            self.assertNotEqual(0, result.returncode)
            self.assertIn('stale', result.stderr)
            self.assertEqual('{"stale": true}\n', target.read_text(encoding='utf-8'))
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stderr)
            result = subprocess.run(command + ['--check'], capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stderr)


class UpdateYcoorTests(unittest.TestCase):
    def setUp(self):
        self.updater = ROOT / 'tools/update-ycoor.py'
        self.assertTrue(self.updater.exists(), 'The one-command Ycoor updater is missing')
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        tools = self.root / 'tools'
        tools.mkdir()
        (tools / self.updater.name).write_bytes(self.updater.read_bytes())
        self.log = self.root / 'calls.jsonl'
        for filename in ['build-b007-reconstruction.py', 'package-streetview-supplements.py', 'package-playground-evidence.py', 'build-design-evidence.py', 'build-facade-inventory.mjs', 'build-p067.py']:
            (tools / filename).write_text(
                'import json, pathlib, sys\n'
                'with (pathlib.Path(__file__).resolve().parents[1] / "calls.jsonl").open("a") as log:\n'
                '    log.write(json.dumps([pathlib.Path(__file__).name, sys.argv[1:]]) + "\\n")\n',
                encoding='utf-8')

    def run_updater(self, *args, **kwargs):
        return subprocess.run([sys.executable, str(self.root / 'tools/update-ycoor.py'), *args],
                              capture_output=True, text=True, **kwargs)

    def test_one_command_runs_all_stages_in_order_and_forwards_check(self):
        result = self.run_updater('--node', sys.executable, '--check')
        self.assertEqual(0, result.returncode, result.stderr)
        calls = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertEqual([['build-b007-reconstruction.py', ['--check']],
                          ['package-streetview-supplements.py', ['--check']],
                          ['package-playground-evidence.py', ['--check']],
                          ['build-design-evidence.py', ['--check']],
                          ['build-facade-inventory.mjs', ['--check']],
                          ['build-p067.py', ['--check']]], calls)

    def test_failed_stage_stops_the_update(self):
        (self.root / 'tools/build-facade-inventory.mjs').write_text('import sys; sys.exit(7)\n')
        result = self.run_updater('--node', sys.executable)
        self.assertEqual(7, result.returncode)
        self.assertEqual([['build-b007-reconstruction.py', []], ['package-streetview-supplements.py', []], ['package-playground-evidence.py', []], ['build-design-evidence.py', []]],
                         [json.loads(line) for line in self.log.read_text().splitlines()])

    def test_missing_node_fails_clearly_before_writing(self):
        environment = dict(os.environ, PATH='')
        result = self.run_updater(env=environment)
        self.assertNotEqual(0, result.returncode)
        self.assertIn('Node.js', result.stderr)
        self.assertIn('--node', result.stderr)
        self.assertFalse(self.log.exists())


if __name__ == '__main__':
    unittest.main()
