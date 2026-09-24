import copy

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from projects.validation import document
from .test_projects import EXAMPLES


class BoardProfileValidationTests(SimpleTestCase):
    def s3_project(self):
        value = copy.deepcopy(EXAMPLES[0])
        value["target"] = {
            "family": "esp32-s3", "framework": "arduino", "coreMajor": 3,
            "coreVersion": "3.3.11", "boardProfile": "diymall-esp32-s3-devkitc-v1-n16r8",
            "fqbn": "esp32:esp32:esp32s3",
        }
        value["scene"]["devices"] = []
        value["scene"]["widgets"] = []
        value["workspace"] = {}
        return value

    def test_exact_s3_target_is_accepted(self):
        self.assertGreater(document(self.s3_project()), 0)

    def test_s3_rejects_oct_psram_pins_and_mixed_target(self):
        value = self.s3_project()
        device = copy.deepcopy(EXAMPLES[0]["scene"]["devices"][0])
        device["pins"] = {"red": 35, "yellow": 4, "green": 5}
        value["scene"]["devices"] = [device]
        with self.assertRaises(ValidationError):
            document(value)

    def test_waveshare_exact_target_and_integrated_display(self):
        value = self.s3_project()
        value["target"]["boardProfile"] = "waveshare-esp32-s3-touch-lcd-5-28117"
        display = copy.deepcopy(EXAMPLES[0]["scene"]["devices"][0])
        display.update(kind="display", id="waveshare-screen", name="Pantalla integrada", pins=dict.fromkeys(("sda", "scl", "sck", "mosi", "cs", "dc", "rst", "rs", "en", "d4", "d5", "d6", "d7", "backlight", "keys")))
        display["config"] = {"profile": "waveshare5", "address": 0, "areas": [{"id": "text-1", "name": "Mensaje", "column": 0, "row": 0, "columns": 16, "rows": 4}], "retiredAreaIds": []}
        value["scene"]["devices"] = [display]
        self.assertGreater(document(value), 0)
        display["config"]["profile"] = "ssd1306"
        display["config"]["address"] = 0x3c
        with self.assertRaisesMessage(ValidationError, "perfil de pantalla"):
            document(value)
        value = self.s3_project()
        value["target"]["fqbn"] = "esp32:esp32:d1_uno32"
        with self.assertRaises(ValidationError):
            document(value)

    def test_waveshare_dashboard_accepts_only_existing_logical_devices(self):
        value = self.s3_project()
        value["target"]["boardProfile"] = "waveshare-esp32-s3-touch-lcd-5-28117"
        display = copy.deepcopy(EXAMPLES[0]["scene"]["devices"][0])
        display.update(kind="display", id="waveshare-screen", name="Pantalla integrada", pins=dict.fromkeys(("sda", "scl", "sck", "mosi", "cs", "dc", "rst", "rs", "en", "d4", "d5", "d6", "d7", "backlight", "keys")))
        display["config"] = {
            "profile": "waveshare5", "address": 0, "areas": [], "retiredAreaIds": [],
            "animationSpeed": "normal", "artworks": [], "retiredArtworkIds": [],
            "dashboard": {"enabled": True, "deviceIds": ["traffic-logical"]},
        }
        traffic = copy.deepcopy(EXAMPLES[0]["scene"]["devices"][0])
        traffic.update(id="traffic-logical", name="Semáforo lógico")
        traffic["pins"] = {"red": None, "yellow": None, "green": None}
        value["scene"]["devices"] = [display, traffic]
        self.assertGreater(document(value), 0)
        display["config"]["dashboard"]["deviceIds"] = ["missing-device"]
        with self.assertRaisesMessage(ValidationError, "control retirado o incompatible"):
            document(value)
