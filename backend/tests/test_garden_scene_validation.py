"""Huerta storage contracts; no database/hardware needed."""
import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class GardenSceneValidationTests(unittest.TestCase):
    def sample(self):
        value = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        value["simulation"]["scene"] = "greenhouse"
        scene = value["scene"]
        scene["sourceTemplate"] = "greenhouse"
        scene["canvas"].update(width=960, height=540, background="greenhouse", gardenEnvironment=dict(sun="medium", outsideTemperature=22, rain=False, changingWeather=False))
        scene["canvas"].pop("itemOrder", None)
        scene["devices"] = [dict(schemaVersion=1, id="garden-window", kind="servo", name="Ventana", position=dict(x=865, y=205), rotation=0, pins=dict(signal=14), config=dict(angle=0))]
        scene["widgets"] = []
        return value

    def test_accepts_world_and_optional_environment(self):
        value = self.sample()
        self.assertGreater(document(value), 0)
        value["scene"]["canvas"].pop("gardenEnvironment")
        self.assertGreater(document(value), 0)

    def test_rejects_invalid_environment(self):
        for key, wrong in (("sun", "night"), ("outsideTemperature", True), ("outsideTemperature", 41), ("rain", 1), ("changingWeather", "yes"), ("extra", 1)):
            value = self.sample()
            value["scene"]["canvas"]["gardenEnvironment"][key] = wrong
            with self.assertRaises(ValidationError):
                document(value)

    def test_rejects_duplicate_or_off_slot(self):
        value = self.sample()
        extra = copy.deepcopy(value["scene"]["devices"][0])
        extra.update(id="second-window", name="Ventana 2", pins=dict(signal=27))
        value["scene"]["devices"].append(extra)
        with self.assertRaises(ValidationError):
            document(value)
        value = self.sample()
        value["scene"]["devices"][0]["position"]["x"] = 800
        with self.assertRaises(ValidationError):
            document(value)

    def test_rejects_wrong_geometry(self):
        value = self.sample()
        value["scene"]["canvas"]["width"] = 1000
        with self.assertRaises(ValidationError):
            document(value)
