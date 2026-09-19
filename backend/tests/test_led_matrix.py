import copy
import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from projects.validation import document


class LedMatrixValidationTests(SimpleTestCase):
    def sample(self):
        data = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0]
        data["scene"]["devices"] = [{
            "schemaVersion": 1, "id": "led-matrix-1", "name": "Matriz LED 1", "kind": "ledMatrix",
            "position": {"x": 100, "y": 100}, "rotation": 0,
            "pins": {"din": 26, "clk": 25, "cs": 27},
            "config": {"brightness": 5, "order": "left-to-right", "orientation": "normal", "patterns": [
                {"id": "heart", "name": "Corazón", "rows": [0, 6, 15, 31, 14, 4, 0, 0]},
            ]},
        }]
        data["scene"]["widgets"] = []
        data["scene"]["retiredDeviceIds"] = []
        blocks = [
            {"type": "capi_matrix_pattern", "id": "pattern", "fields": {"DEVICE_ID": "led-matrix-1", "PATTERN_ID": "heart"}},
            {"type": "capi_matrix_pixel", "id": "pixel", "fields": {"DEVICE_ID": "led-matrix-1", "X": 1, "Y": 2, "ENABLED": "ON"}},
            {"type": "capi_matrix_scroll", "id": "scroll", "fields": {"DEVICE_ID": "led-matrix-1", "TEXT": "HOLA", "SPEED": 100}},
            {"type": "capi_matrix_clear", "id": "clear", "fields": {"DEVICE_ID": "led-matrix-1"}},
        ]
        for first, second in zip(blocks, blocks[1:]):
            first["next"] = {"block": second}
        data["workspace"] = {"blocks": {"languageVersion": 0, "blocks": [{"type": "capi_start", "id": "start", "inputs": {"DO": {"block": blocks[0]}}}]}}
        return data

    def test_matrix_and_blocks_are_portable(self):
        self.assertGreater(document(self.sample()), 0)

    def test_rejects_bad_rows_duplicate_patterns_and_second_screen(self):
        for change in ("bad-row", "duplicate"):
            data = self.sample()
            if change == "bad-row":
                data["scene"]["devices"][0]["config"]["patterns"][0]["rows"][0] = 2 ** 32
            else:
                data["scene"]["devices"][0]["config"]["patterns"].append(copy.deepcopy(data["scene"]["devices"][0]["config"]["patterns"][0]))
            with self.assertRaises(ValidationError):
                document(data)
        data = self.sample()
        display = {
            "schemaVersion": 1, "id": "display-2", "name": "Otra pantalla", "kind": "display",
            "position": {"x": 200, "y": 100}, "rotation": 0,
            "pins": {"sda": 21, "scl": 22, "sck": None, "mosi": None, "cs": None, "dc": None, "rst": None},
            "config": {"profile": "lcd1602", "address": 0x27, "areas": [], "retiredAreaIds": []},
        }
        data["scene"]["devices"].append(display)
        with self.assertRaisesMessage(ValidationError, "una sola pantalla o matriz"):
            document(data)
