import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class ConveyorSceneValidationTests(unittest.TestCase):
    def sample(self):
        v = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        v["simulation"]["scene"] = "conveyor"
        s = v["scene"]
        s["sourceTemplate"] = "conveyor"
        s["canvas"].update(width=960, height=540, background="conveyor", conveyorEnvironment=dict(automaticArrivals=True, color="red", weight=300))
        s["canvas"].pop("itemOrder", None)
        s["devices"] = [dict(schemaVersion=1, id="conveyor-gate", kind="servo", name="Desviador", position=dict(x=640, y=270), rotation=0, pins=dict(signal=14), config=dict(angle=0))]
        s["widgets"] = []
        return v

    def test_accepts_initial_and_legacy_defaults(self):
        v = self.sample()
        self.assertGreater(document(v), 0)
        del v["scene"]["canvas"]["conveyorEnvironment"]
        self.assertGreater(document(v), 0)

    def test_rejects_bad_environment(self):
        for key, value in (("automaticArrivals", 1), ("color", "amarillo"), ("weight", 99), ("weight", 1001), ("extra", True)):
            v = self.sample()
            v["scene"]["canvas"]["conveyorEnvironment"][key] = value
            with self.assertRaises(ValidationError):
                document(v)

    def test_rejects_geometry_and_duplicate_slots(self):
        for operation in ("position", "size", "duplicate"):
            v = self.sample()
            if operation == "position":
                v["scene"]["devices"][0]["position"]["x"] = 600
            elif operation == "size":
                v["scene"]["canvas"]["width"] = 900
            else:
                second = copy.deepcopy(v["scene"]["devices"][0])
                second["id"] = "second-gate"
                second["name"] = "Otro desviador"
                second["pins"]["signal"] = 13
                v["scene"]["devices"].append(second)
            with self.assertRaises(ValidationError):
                document(v)

    def test_optional_components_can_be_removed(self):
        v = self.sample()
        v["scene"]["devices"] = []
        self.assertGreater(document(v), 0)
