"""Storage contract for the railway world; no database or hardware required."""
import copy
import json
import unittest
from pathlib import Path

from django.core.exceptions import ValidationError
from projects.validation import document


class RailSceneValidationTests(unittest.TestCase):
    def sample(self):
        value = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        scene = value["scene"]
        value["simulation"]["scene"] = "railCrossing"
        scene["canvas"].update(width=960, height=540, background="railCrossing")
        scene["sourceTemplate"] = "railCrossing"
        scene["canvas"].pop("itemOrder", None)
        scene["devices"] = []
        scene["widgets"] = []
        for index, (kind, x, y, gpio) in enumerate((("servo", 395, 185, 14), ("servo", 565, 355, 27), ("infraredBarrier", 140, 270, 34), ("infraredBarrier", 820, 270, 35))):
            scene["devices"].append(dict(schemaVersion=1, id=f"rail-{index}", kind=kind, name=f"Elemento {index}", position=dict(x=x, y=y), rotation=0, pins=dict(signal=gpio), config=dict(angle=90) if kind == "servo" else dict(interrupted=False, interruptedLevel="LOW")))
        return value

    def test_accepts_rail_background_and_existing_component_profiles(self):
        self.assertGreater(document(self.sample()), 0)

    def test_accepts_two_and_four_tracks_with_separate_detectors(self):
        for tracks, ys, gates in ((2, [230, 310], (145, 395)), (4, [180, 240, 300, 360], (105, 435))):
            value = self.sample()
            scene = value["scene"]
            scene["canvas"]["railTracks"] = tracks
            scene["devices"] = scene["devices"][:2]
            for item, y in zip(scene["devices"], gates):
                item["position"]["y"] = y
            for index, (x, y) in enumerate((x, y) for y in ys for x in (140, 820)):
                scene["devices"].append(dict(schemaVersion=1, id=f"sensor-{index}", kind="infraredBarrier", name=f"Sensor {index}", position=dict(x=x, y=y), rotation=0, pins=dict(signal=None), config=dict(interrupted=False, interruptedLevel="LOW")))
            self.assertGreater(document(value), 0)
            scene["devices"][-1]["position"]["y"] = 270
            with self.assertRaises(ValidationError):
                document(value)

    def test_rejects_unsupported_track_counts(self):
        for tracks in (0, 3, 8, True, "2", None):
            value = self.sample()
            value["scene"]["canvas"]["railTracks"] = tracks
            with self.assertRaises(ValidationError):
                document(value)

    def test_rejects_duplicate_slots_and_off_slot_components(self):
        for position in (dict(x=395, y=185), dict(x=400, y=200)):
            value = self.sample()
            value["scene"]["devices"][1]["position"] = position
            with self.assertRaises(ValidationError):
                document(value)

    def test_accepts_partial_hardware_but_not_wrong_canvas(self):
        value = self.sample()
        value["scene"]["devices"] = []
        self.assertGreater(document(value), 0)
        value["scene"]["canvas"]["width"] = 480
        with self.assertRaises(ValidationError):
            document(value)
