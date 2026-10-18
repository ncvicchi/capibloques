import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class HouseSceneValidationTests(unittest.TestCase):
    def sample(self):
        v = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        v["simulation"]["scene"] = "smartHouse"
        s = v["scene"]
        s["sourceTemplate"] = "smartHouse"
        s["canvas"].update(width=960, height=540, background="smartHouse", houseEnvironment=dict(night=False, automaticDay=False, automaticArrivals=True, nextVisitor="known"))
        s["canvas"].pop("itemOrder", None)
        s["devices"] = [dict(schemaVersion=1, id="house-door", kind="servo", name="Puerta", position=dict(x=450, y=280), rotation=0, pins=dict(signal=14), config=dict(angle=0))]
        s["widgets"] = []
        return v

    def test_accepts_world_and_environment_default(self):
        v = self.sample()
        self.assertGreater(document(v), 0)
        del v["scene"]["canvas"]["houseEnvironment"]
        self.assertGreater(document(v), 0)

    def test_rejects_bad_environment(self):
        for key, bad in (("night", 1), ("automaticDay", "yes"), ("nextVisitor", "admin"), ("extra", True)):
            v = self.sample()
            v["scene"]["canvas"]["houseEnvironment"][key] = bad
            with self.assertRaises(ValidationError):
                document(v)

    def test_rejects_bad_slots_and_geometry(self):
        v = self.sample()
        v["scene"]["devices"][0]["position"]["x"] = 400
        with self.assertRaises(ValidationError):
            document(v)
        v = self.sample()
        v["scene"]["canvas"]["width"] = 900
        with self.assertRaises(ValidationError):
            document(v)

    def test_assignments_need_existing_compatible_unique_components(self):
        for mapping in ({"bell": "house-door"}, {"outsideLight": "missing"}, {"unknown": "house-door"}):
            v = self.sample()
            v["scene"]["canvas"]["houseAssignments"] = mapping
            with self.assertRaises(ValidationError):
                document(v)
