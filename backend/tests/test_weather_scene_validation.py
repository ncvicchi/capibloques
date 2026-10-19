import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class WeatherSceneValidationTests(unittest.TestCase):
    def sample(self):
        v = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        v["simulation"]["scene"] = "weatherLab"
        s = v["scene"]
        s["sourceTemplate"] = "weatherLab"
        s["canvas"].update(width=960,height=540,background="weatherLab",weatherEnvironment=dict(condition="sunny",night=False,automatic=True))
        s["canvas"].pop("itemOrder", None)
        s["devices"] = [dict(schemaVersion=1,id="weather-roof",kind="servo",name="Techo",position=dict(x=650,y=245),rotation=0,pins=dict(signal=14),config=dict(angle=90))]
        s["widgets"] = []
        return v

    def test_accepts_configuration_and_absent_defaults(self):
        v = self.sample()
        self.assertGreater(document(v), 0)
        del v["scene"]["canvas"]["weatherEnvironment"]
        self.assertGreater(document(v), 0)

    def test_rejects_bad_environment(self):
        for key, bad in (("night",1),("automatic","yes"),("condition","wind"),("extra",True)):
            v = self.sample()
            v["scene"]["canvas"]["weatherEnvironment"][key] = bad
            with self.assertRaises(ValidationError):
                document(v)

    def test_rejects_bad_geometry_and_duplicate_roof(self):
        for change in ("size","position","duplicate"):
            v = self.sample()
            if change == "size":
                v["scene"]["canvas"]["width"] = 900
            elif change == "position":
                v["scene"]["devices"][0]["position"]["x"] = 600
            else:
                other = copy.deepcopy(v["scene"]["devices"][0])
                other.update(id="roof-two",name="Otro techo")
                other["pins"]["signal"] = None
                v["scene"]["devices"].append(other)
            with self.assertRaises(ValidationError):
                document(v)

    def test_missing_components_allowed_without_replacing_them(self):
        v = self.sample()
        v["scene"]["devices"] = []
        self.assertGreater(document(v), 0)
