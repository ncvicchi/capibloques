from django.core.exceptions import ValidationError
from django.test import SimpleTestCase
from projects.validation import workspace


class ParallelWorkspaceTests(SimpleTestCase):
    def sample(self):
        return {"blocks": {"languageVersion": 0, "blocks": [{"type": "capi_start", "id": "start", "deletable": False, "inputs": {"DO": {"block": {"type": "capi_parallel", "id": "roads", "extraState": {"branches": 2}, "fields": {"BRANCHES": "2"}, "inputs": {"BRANCH0": {"block": {"type": "capi_wait", "id": "wait", "fields": {"SECONDS": 1}}}}}}}}]}}

    def test_parallel_portable_workspace_accepts_protected_root(self):
        workspace(self.sample())

    def test_parallel_rejects_lost_paths_or_inconsistent_count(self):
        for change in ({"extraState": {"branches": 17}}, {"extraState": {"branches": 3}}, {"inputs": {"BRANCH9": {"block": {"type": "capi_wait", "id": "lost"}}}}, {"extraState": []}):
            with self.subTest(change=change):
                data = self.sample()
                data["blocks"]["blocks"][0]["inputs"]["DO"]["block"].update(change)
                with self.assertRaises(ValidationError):
                    workspace(data)

    def test_legacy_multiple_starts_remain_readable_without_rewriting_history(self):
        workspace({"blocks": {"languageVersion": 0, "blocks": [{"type": "capi_start", "id": "a"}, {"type": "capi_start", "id": "b"}]}})
