"""Parking storage contracts; no database or physical hardware required."""
import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class ParkingSceneValidationTests(unittest.TestCase):
    def sample(self):
        value = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        value["simulation"]["scene"] = "parking"
        scene = value["scene"]
        scene["canvas"].update(width=960, height=540, background="parking", parkingCapacity=8)
        scene["canvas"].pop("itemOrder", None)
        scene["sourceTemplate"] = "parking"
        scene["devices"], scene["widgets"] = [], []
        slots = (("servo", 105, 430, 14), ("servo", 855, 430, 27), ("infraredBarrier", 160, 480, 34), ("infraredBarrier", 160, 375, 35), ("infraredBarrier", 800, 390, 36), ("infraredBarrier", 800, 485, 39))
        for i, (kind, x, y, gpio) in enumerate(slots):
            scene["devices"].append(dict(schemaVersion=1, id=f"parking-{i}", kind=kind, name=f"Elemento {i}", position=dict(x=x, y=y), rotation=0, pins=dict(signal=gpio), config=dict(angle=0) if kind == "servo" else dict(interrupted=False, interruptedLevel="LOW")))
        return value

    def test_accepts_capacity_and_legacy_default(self):
        for capacity in (4, 8, 12):
            value = self.sample()
            value["scene"]["canvas"]["parkingCapacity"] = capacity
            self.assertGreater(document(value), 0)
        value["scene"]["canvas"].pop("parkingCapacity")
        self.assertGreater(document(value), 0)

    def test_rejects_bad_capacity(self):
        for capacity in (0, 6, 16, True, "8", None):
            value = self.sample()
            value["scene"]["canvas"]["parkingCapacity"] = capacity
            with self.assertRaises(ValidationError):
                document(value)

    def test_rejects_duplicate_and_off_slot_components(self):
        for position in (dict(x=105, y=430), dict(x=840, y=400)):
            value = self.sample()
            value["scene"]["devices"][1]["position"] = position
            with self.assertRaises(ValidationError):
                document(value)

    def test_allows_incomplete_scene_not_wrong_canvas(self):
        value = self.sample()
        value["scene"]["devices"] = []
        self.assertGreater(document(value), 0)
        value["scene"]["canvas"]["height"] = 480
        with self.assertRaises(ValidationError):
            document(value)
