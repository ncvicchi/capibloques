import copy
import json
from pathlib import Path

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from projects.validation import document


class MessagesValidationTests(SimpleTestCase):
    def sample(self, mode="both"):
        data = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0]
        data["scene"]["devices"] = [{
            "schemaVersion": 1, "id": "messages-1", "name": "Enviar y recibir 1", "kind": "messages",
            "position": {"x": 100, "y": 100}, "rotation": 0,
            "pins": {"tx": None if mode == "receive" else 17, "rx": None if mode == "send" else 16},
            "config": {"mode": mode, "baudRate": 9600, "messages": ["AVANZAR", "DETENER"]},
        }]
        data["scene"]["widgets"] = []
        data["scene"]["retiredDeviceIds"] = []
        data["workspace"] = {"blocks": {"languageVersion": 0, "blocks": [{
            "type": "capi_start", "id": "start", "inputs": {"DO": {"block": {
                "type": "capi_message_send" if mode != "receive" else "capi_message_receive",
                "id": "message", "fields": {"DEVICE_ID": "messages-1", "MESSAGE": "AVANZAR"},
            }}}
        }]}}
        return data

    def test_modes_and_blocks_are_portable(self):
        for mode in ("send", "receive", "both"):
            with self.subTest(mode=mode):
                self.assertGreater(document(self.sample(mode)), 0)

    def test_rejects_invalid_messages_and_unused_pin(self):
        for messages in ([], [""], ["A", "A"], ["á" * 61]):
            data = self.sample()
            data["scene"]["devices"][0]["config"]["messages"] = messages
            with self.assertRaises(ValidationError):
                document(data)
        data = self.sample("send")
        data["scene"]["devices"][0]["pins"]["rx"] = 16
        with self.assertRaises(ValidationError):
            document(data)

    def test_rejects_more_than_two_links(self):
        data = self.sample()
        for index in (2, 3):
            extra = copy.deepcopy(data["scene"]["devices"][0])
            extra.update(id=f"messages-{index}", name=f"Mensajes {index}")
            extra["pins"] = {"tx": 17 + index, "rx": 25 + index}
            data["scene"]["devices"].append(extra)
        with self.assertRaisesMessage(ValidationError, "hasta dos"):
            document(data)
