import copy
import json
import unittest
from pathlib import Path
from django.core.exceptions import ValidationError
from projects.validation import document


class ArenaSceneValidationTests(unittest.TestCase):
    def sample(self):
        v = copy.deepcopy(json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))[0])
        v["simulation"]["scene"] = "robotArena"
        s = v["scene"]
        s["sourceTemplate"] = "robotArena"
        s["canvas"].update(width=960, height=540, background="robotArena", arenaEnvironment=dict(guides=True, obstacles=[dict(x=260, y=420, radius=28)]))
        s["canvas"].pop("itemOrder", None)
        s["devices"] = [dict(schemaVersion=1, id="arena-robot", kind="robot", name="Explorador", position=dict(x=120,y=420), rotation=0, pins=dict(leftIn1=17,leftIn2=16,rightIn1=23,rightIn2=19), config=dict(speed=0,heading=0,color="#38bdf8"))]
        s["widgets"] = []
        return v

    def test_accepts_environment_and_absent_defaults(self):
        v = self.sample()
        self.assertGreater(document(v), 0)
        del v["scene"]["canvas"]["arenaEnvironment"]
        self.assertGreater(document(v), 0)

    def test_rejects_invalid_or_overlapping_obstacles(self):
        for obstacles in ([dict(x=400,y=420,radius=28)], [dict(x=120,y=420,radius=28)], [dict(x=260,y=420,radius=28)] * 2, [dict(x=260,y=420,radius=5)]):
            v = self.sample()
            v["scene"]["canvas"]["arenaEnvironment"]["obstacles"] = obstacles
            with self.assertRaises(ValidationError):
                document(v)

    def test_rejects_duplicate_robot_and_invalid_start(self):
        for operation in ("duplicate", "contact", "outside"):
            v = self.sample()
            if operation == "duplicate":
                second = copy.deepcopy(v["scene"]["devices"][0])
                second.update(id="another-robot",name="Otro")
                second["pins"] = {k: None for k in second["pins"]}
                v["scene"]["devices"].append(second)
            else:
                v["scene"]["devices"][0]["position"] = dict(x=260,y=420) if operation == "contact" else dict(x=10,y=20)
            with self.assertRaises(ValidationError):
                document(v)

    def test_rejects_extra_environment_keys_and_geometry(self):
        for operation in ("extra", "guides", "size"):
            v = self.sample()
            if operation == "size":
                v["scene"]["canvas"]["width"] = 900
            else:
                v["scene"]["canvas"]["arenaEnvironment"][operation] = 1
            with self.assertRaises(ValidationError):
                document(v)
