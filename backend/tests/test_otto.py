import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from projects.validation import document


class OttoValidationTests(SimpleTestCase):
    def sample(self):
        data = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0]
        data["scene"]["devices"] = [{
            "schemaVersion": 1, "id": "otto-1", "name": "Otto básico", "kind": "otto",
            "position": {"x": 100, "y": 100}, "rotation": 0,
            "pins": {"leftLeg": 13, "rightLeg": 14, "leftFoot": 16, "rightFoot": 17},
            "config": {"profile": "biped4", "centers": [90, 90, 90, 90], "reversed": [False, True, False, True]},
        }]
        data["scene"]["widgets"] = []
        data["workspace"] = {"blocks": {"languageVersion": 0, "blocks": [{
            "type": "capi_start", "id": "start", "inputs": {"DO": {"block": {
                "type": "capi_otto", "id": "walk", "fields": {"DEVICE_ID": "otto-1", "ACTION": "WALK_FORWARD", "SPEED": 60, "REPETITIONS": 2},
            }}},
        }]}}
        return data

    def test_otto_and_block_are_portable(self):
        self.assertGreater(document(self.sample()), 0)

    def test_rejects_invalid_calibration(self):
        for key, value in (("centers", [90, 180, 90, 90]), ("reversed", [False])):
            data = self.sample()
            data["scene"]["devices"][0]["config"][key] = value
            with self.subTest(key=key), self.assertRaises(ValidationError):
                document(data)
