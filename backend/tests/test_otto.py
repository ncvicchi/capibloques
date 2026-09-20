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
            "pins": {"leftLeg": 13, "rightLeg": 14, "leftFoot": 16, "rightFoot": 17, "leftArm": None, "rightArm": None, "buzzer": None, "trigger": None, "echo": None, "matrixDin": None, "matrixClk": None, "matrixCs": None},
            "config": {"profile": "biped4", "centers": [90, 90, 90, 90, 90, 90], "reversed": [False, True, False, True, False, True], "matrixBrightness": 4},
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
        for key, value in (("centers", [90, 180, 90, 90, 90, 90]), ("reversed", [False])):
            data = self.sample()
            data["scene"]["devices"][0]["config"][key] = value
            with self.subTest(key=key), self.assertRaises(ValidationError):
                document(data)

    def test_complete_humanoid_profile_and_blocks_are_portable(self):
        data = self.sample()
        otto = data["scene"]["devices"][0]
        otto["config"]["profile"] = "humanoid6-expressive"
        otto["pins"] = {
            "leftLeg": 4, "rightLeg": 13, "leftFoot": 14, "rightFoot": 16,
            "leftArm": 17, "rightArm": 18, "buzzer": 19, "trigger": 23,
            "echo": 34, "matrixDin": 25, "matrixClk": 26, "matrixCs": 27,
        }
        start = data["workspace"]["blocks"]["blocks"][0]
        arms = {"type": "capi_otto_arms", "id": "arms", "fields": {"DEVICE_ID": "otto-1", "POSE": "UP"}}
        face = {
            "type": "capi_otto_expression", "id": "face",
            "fields": {"DEVICE_ID": "otto-1", "EXPRESSION": "LOVE"},
            "next": {"block": arms},
        }
        sound = {
            "type": "capi_otto_sound", "id": "sound",
            "fields": {"DEVICE_ID": "otto-1", "SOUND": "HAPPY"},
            "next": {"block": face},
        }
        start["inputs"]["DO"]["block"]["next"] = {"block": sound}
        self.assertGreater(document(data), 0)

    def test_rejects_pins_not_used_by_selected_profile(self):
        data = self.sample()
        data["scene"]["devices"][0]["pins"]["buzzer"] = 19
        with self.assertRaises(ValidationError):
            document(data)
