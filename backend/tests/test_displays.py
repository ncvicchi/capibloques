import copy
import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from projects.validation import document, display_config


class DisplayValidationTests(SimpleTestCase):
    def sample(self, profile="ssd1306"):
        data = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0]
        config = {"profile": profile, "address": 0 if profile.startswith("ili") else 0x3c if profile == "ssd1306" else 0x27, "areas": [] if profile.startswith("lcd") else [{"id": "text-1", "name": "Mensaje", "column": 0, "row": 0, "columns": 16, "rows": 4}], "retiredAreaIds": []}
        pins = dict.fromkeys(("sda", "scl", "sck", "mosi", "cs", "dc", "rst"))
        for key, gpio in zip(["sck", "mosi", "cs", "dc", "rst"] if profile.startswith("ili") else ["sda", "scl"], [26, 25, 27, 17, 16]):
            pins[key] = gpio
        data["scene"]["devices"] = [{"schemaVersion": 1, "id": "screen-1", "name": "Pantalla", "kind": "display", "position": {"x": 100, "y": 100}, "rotation": 0, "pins": pins, "config": config}]
        data["scene"]["widgets"] = []
        data["scene"]["retiredDeviceIds"] = []
        data["workspace"] = {"blocks": {"languageVersion": 0, "blocks": [{"type": "capi_start", "id": "start", "inputs": {"DO": {"block": {"type": "capi_display_write", "id": "message", "fields": {"DEVICE_ID": "screen-1", "AREA_ID": "screen" if profile.startswith("lcd") else "text-1", "TEXT": "Hola\nESP32"}, "next": {"block": {"type": "capi_display_clear", "id": "clear", "fields": {"DEVICE_ID": "screen-1", "AREA_ID": "screen"}}}}}}}]}}
        return data

    def test_all_five_profiles_and_message_blocks_are_portable(self):
        for profile in ("lcd1602", "lcd2004", "ssd1306", "ili9341", "ili9488"):
            with self.subTest(profile=profile):
                data = self.sample(profile)
                self.assertGreater(document(data), 0)
                self.assertEqual(data, json.loads(json.dumps(data)))

    def test_one_screen_per_project(self):
        data = self.sample()
        other = copy.deepcopy(data["scene"]["devices"][0])
        other.update(id="screen-2", name="Otra pantalla")
        data["scene"]["devices"].append(other)
        with self.assertRaisesMessage(ValidationError, "una sola pantalla"):
            document(data)

    def test_rejects_invalid_profile_pins_address_and_unknown_config(self):
        for patch in ({"profile": "iliXXXX"}, {"address": 0x27}, {"address": True}, {"extra": 1}, {"retiredAreaIds": ["text-1"]}, {"retiredAreaIds": ["old", "old"]}):
            with self.subTest(patch=patch):
                data = self.sample()
                data["scene"]["devices"][0]["config"].update(patch)
                with self.assertRaises(ValidationError): document(data)
        data = self.sample()
        data["scene"]["devices"][0]["pins"]["sck"] = 14
        with self.assertRaises(ValidationError): document(data)

    def test_rejects_overlapping_outside_duplicate_and_unbounded_areas(self):
        for patch in ({"column": -1}, {"rows": 9}, {"rows": 0}, {"columns": 17}, {"row": 0.5}, {"name": ""}, {"id": "screen"}):
            with self.subTest(patch=patch):
                data = self.sample()
                config = data["scene"]["devices"][0]["config"]
                config["areas"][0].update(patch)
                with self.assertRaises(ValidationError): display_config(config)
        config = self.sample()["scene"]["devices"][0]["config"]
        config["areas"].append({**config["areas"][0], "id": "second", "name": "Estado"})
        with self.assertRaises(ValidationError): display_config(config)
        config["areas"][1]["row"] = 4
        display_config(config)
        config["retiredAreaIds"] = ["old"]
        display_config(config)
