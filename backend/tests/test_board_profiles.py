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
        value = self.s3_project()
        value["target"]["fqbn"] = "esp32:esp32:d1_uno32"
        with self.assertRaises(ValidationError):
            document(value)
