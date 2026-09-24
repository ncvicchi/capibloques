import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from projects.validation import document


class SmartLightsValidationTests(SimpleTestCase):
    def sample(self):
        data = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0]
        data["scene"]["devices"] = [{
            "schemaVersion": 1, "id": "smart-lights-1", "name": "Luces RGB 1", "kind": "smartLights",
            "position": {"x": 100, "y": 100}, "rotation": 0, "pins": {"signal": 13},
            "config": {"profile": "WS2812B", "geometry": "strip", "count": 8, "width": 8, "height": 1, "layout": "progressive", "origin": "top-left", "colorOrder": "GRB", "brightness": 40},
        }]
        data["scene"]["widgets"] = []
        data["scene"]["retiredDeviceIds"] = []
        data["workspace"] = {"blocks": {"languageVersion": 0, "blocks": [{"type": "capi_start", "id": "start", "inputs": {"DO": {"block": {"type": "capi_rgb_fill", "id": "fill", "fields": {"DEVICE_ID": "smart-lights-1", "COLOR": "#123456", "BRIGHTNESS": 40}}}}}]}}
        return data

    def test_smart_lights_project_is_portable(self):
        self.assertGreater(document(self.sample()), 0)

    def test_rejects_inconsistent_geometry(self):
        data = self.sample()
        data["scene"]["devices"][0]["config"].update(geometry="matrix", width=3, height=3)
        with self.assertRaises(ValidationError):
            document(data)
