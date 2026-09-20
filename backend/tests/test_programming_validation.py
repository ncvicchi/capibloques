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

    def test_visual_animation_wait_is_portable(self):
        workspace({"blocks": {"languageVersion": 0, "blocks": [{"type": "capi_start", "id": "start", "inputs": {"DO": {"block": {"type": "capi_visual_wait", "id": "wait-screen", "fields": {"DEVICE_ID": "screen-1"}}}}}]}})


class VariableWorkspaceTests(SimpleTestCase):
    def test_typed_variables_and_value_blocks_are_portable(self):
        workspace({
            "variables": [
                {"name": "puntos", "id": "score", "type": "Number"},
                {"name": "saludo", "id": "greeting", "type": "String"},
                {"name": "listo", "id": "ready", "type": "Boolean"},
            ],
            "blocks": {
                "languageVersion": 0,
                "blocks": [{
                    "type": "capi_start",
                    "id": "start",
                    "inputs": {"DO": {"block": {
                        "type": "capi_variable_set_number",
                        "id": "set-score",
                        "fields": {"VAR": {"id": "score"}},
                        "inputs": {"VALUE": {"block": {
                            "type": "capi_number_math",
                            "id": "sum",
                            "fields": {"OPERATOR": "ADD"},
                            "inputs": {
                                "LEFT": {"block": {"type": "capi_counter_value", "id": "counter"}},
                                "RIGHT": {"shadow": {"type": "capi_value_number", "id": "five", "fields": {"VALUE": 5}}},
                            },
                        }}},
                    }}},
                }],
            },
        })

    def test_variables_reject_duplicates_unknown_types_and_excess(self):
        invalid_variables = (
            [
                {"name": "Puntos", "id": "one", "type": "Number"},
                {"name": "puntos", "id": "two", "type": "Number"},
            ],
            [{"name": "dato", "id": "one", "type": "Object"}],
            [{"name": f"dato {index}", "id": f"id-{index}", "type": "Number"} for index in range(33)],
        )
        for variables in invalid_variables:
            with self.subTest(variables=variables), self.assertRaises(ValidationError):
                workspace({"variables": variables, "blocks": {"languageVersion": 0, "blocks": []}})
