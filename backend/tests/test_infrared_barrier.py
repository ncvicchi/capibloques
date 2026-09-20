import copy
import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from projects.validation import document


class InfraredBarrierValidationTests(SimpleTestCase):
    def sample(self):
        data = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0]
        data["scene"]["devices"] = [{
            "schemaVersion": 1,
            "id": "infrared-barrier-1",
            "name": "Barrera infrarroja 1",
            "kind": "infraredBarrier",
            "position": {"x": 100, "y": 100},
            "rotation": 0,
            "pins": {"signal": 4},
            "config": {"interrupted": False, "interruptedLevel": "LOW"},
        }]
        data["scene"]["widgets"] = []
        data["scene"]["retiredDeviceIds"] = []
        data["workspace"] = {"blocks": {"languageVersion": 0, "blocks": [{
            "type": "capi_start", "id": "start", "inputs": {"DO": {"block": {
                "type": "capi_if", "id": "if", "inputs": {"CONDITION": {"block": {
                    "type": "capi_barrier_state", "id": "barrier", "fields": {
                        "DEVICE_ID": "infrared-barrier-1", "STATE": "INTERRUPTED",
                    },
                }}},
            }}},
        }]}}
        return data

    def test_barrier_and_block_are_portable(self):
        self.assertGreater(document(self.sample()), 0)

    def test_rejects_bad_polarity_and_config_shape(self):
        for change in ("polarity", "extra"):
            data = self.sample()
            if change == "polarity":
                data["scene"]["devices"][0]["config"]["interruptedLevel"] = "AUTO"
            else:
                data["scene"]["devices"][0]["config"]["analogValue"] = 500
            with self.subTest(change=change), self.assertRaises(ValidationError):
                document(data)

        data = self.sample()
        duplicate = copy.deepcopy(data["scene"]["devices"][0])
        duplicate.update(id="infrared-barrier-2", name="Barrera infrarroja 2")
        duplicate["pins"]["signal"] = 13
        data["scene"]["devices"].append(duplicate)
        self.assertGreater(document(data), 0)
