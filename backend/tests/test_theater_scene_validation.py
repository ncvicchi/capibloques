import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class TheaterSceneValidationTests(unittest.TestCase):
    def sample(self):
        v = copy.deepcopy(json.loads((Path(__file__).parent / 'fixtures/projects-v2.json').read_text(encoding='utf-8'))[0])
        v['simulation']['scene'] = 'ottoTheater'
        s = v['scene']
        s['sourceTemplate'] = 'ottoTheater'
        s['canvas'].update(width=960, height=540, background='ottoTheater', theaterEnvironment=dict(automaticArrivals=True, count=3, distance=35, staySeconds=24))
        s['canvas'].pop('itemOrder', None)
        s['devices'] = [dict(schemaVersion=1, id='request', kind='button', name='Pedir actuación', position=dict(x=760, y=360), rotation=0, pins=dict(signal=4), config=dict(pressed=False, pullup=True))]
        s['widgets'] = []
        return v

    def test_accepts_configuration_and_absent_defaults(self):
        v = self.sample()
        self.assertGreater(document(v), 0)
        del v['scene']['canvas']['theaterEnvironment']
        self.assertGreater(document(v), 0)

    def test_rejects_bad_environment(self):
        for key, bad in (('automaticArrivals', 1), ('count', True), ('count', 5), ('count', 1.5), ('distance', 101), ('staySeconds', 11), ('extra', True)):
            v = self.sample()
            v['scene']['canvas']['theaterEnvironment'][key] = bad
            with self.subTest(key=key, bad=bad), self.assertRaises(ValidationError):
                document(v)

    def test_rejects_geometry_and_duplicate_button(self):
        for change in ('size', 'position', 'duplicate'):
            v = self.sample()
            if change == 'size':
                v['scene']['canvas']['width'] = 900
            elif change == 'position':
                v['scene']['devices'][0]['position']['x'] = 700
            else:
                other = copy.deepcopy(v['scene']['devices'][0])
                other['id'] = 'request-two'
                other['pins']['signal'] = None
                v['scene']['devices'].append(other)
            with self.subTest(change=change), self.assertRaises(ValidationError):
                document(v)

    def test_missing_components_can_be_saved(self):
        v = self.sample()
        v['scene']['devices'] = []
        self.assertGreater(document(v), 0)
