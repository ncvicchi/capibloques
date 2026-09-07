"""Contrato de almacenamiento v2, alineado con decodeProject/scene-model.

No ejecuta bloques ni genera fuentes. La migración v1 se hace en el importador
existente del cliente; el resultado v2 vuelve a validarse aquí antes de persistir.
"""
import json
import math
import re
import unicodedata

from django.core.exceptions import ValidationError

MAX_FILE_BYTES = 2_000_000
TARGET = {"family": "esp32", "framework": "arduino", "coreMajor": 3, "coreVersion": "3.3.11", "boardProfile": "wemos-d1-r32", "fqbn": "esp32:esp32:d1_uno32"}
BLOCKS = {"capi_" + name for name in ("start", "forever", "repeat", "wait", "if", "compare", "counter_compare", "counter_set", "counter_change", "traffic", "led", "pin_write", "robot", "motor", "servo", "buzzer", "tone", "button_pressed", "sensor_compare", "wifi_connect", "wifi_connected", "serial")}
BLOCKS.add("capi_parallel")
PINS = {"trafficLight": ["red", "yellow", "green"], "robot": ["leftIn1", "leftIn2", "rightIn1", "rightIn2"], "motor": ["in1", "in2"], **{kind: ["signal"] for kind in ("led", "servo", "activeBuzzer", "passiveBuzzer", "button", "lightSensor", "potentiometer")}, "wifiNode": []}
CONFIGS = {
    "trafficLight": {"redBrightness": (0, 100), "yellowBrightness": (0, 100), "greenBrightness": (0, 100)},
    "robot": {"speed": (0, 100), "heading": (-360000, 360000), "color": 64},
    "motor": {"power": (0, 100), "driver": ["DRV8833"]}, "led": {"brightness": (0, 100), "color": 64},
    "servo": {"angle": (0, 180)}, "activeBuzzer": {"enabled": bool},
    "passiveBuzzer": {"frequency": (20, 20000), "durationMs": (10, 60000)},
    "button": {"pressed": bool, "pullup": bool}, "lightSensor": {"value": (0, 4095)}, "potentiometer": {"value": (0, 4095)},
    "wifiNode": {"status": ["idle", "connecting", "connected", "error"], "ssid": 64},
    "counter": {"value": (-1e308, 1e308), "mascot": 32},
}


def require(condition, message="El proyecto contiene una estructura o valores no compatibles."):
    if not condition:
        raise ValidationError(message)


def exact(value, required, optional=()):
    require(isinstance(value, dict) and set(required) <= set(value) <= set(required) | set(optional))


def number(value, low=-1e308, high=1e308):
    try:
        return type(value) in (int, float) and math.isfinite(value) and low <= value <= high
    except OverflowError:
        return False


def text(value, maximum, minimum=0):
    return isinstance(value, str) and minimum <= len(value) <= maximum and all(ord(c) >= 32 and ord(c) not in (127, 0x2028, 0x2029) and not 0xD800 <= ord(c) <= 0xDFFF for c in value)


def identifier(value):
    return text(value, 128, 1) and bool(value.strip())


def title(value):
    require(text(value, 80, 1) and value.strip(), "El nombre del proyecto debe tener entre 1 y 80 caracteres.")
    return value.strip()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")


def bounded_json(value, depth_limit=144, node_limit=35000):
    stack = [(value, 0)]
    nodes = 0
    while stack:
        item, depth = stack.pop()
        nodes += 1
        require(depth <= depth_limit and nodes <= node_limit, "El proyecto es demasiado profundo o complejo.")
        if isinstance(item, dict):
            require(len(item) <= 512)
            for key, child in item.items():
                require(text(key, 16384) and key not in ("__proto__", "prototype", "constructor"))
                stack.append((child, depth + 1))
        elif isinstance(item, list):
            require(len(item) <= 20000)
            stack.extend((child, depth + 1) for child in item)
        elif isinstance(item, str):
            # Mensajes Blockly pueden incluir saltos/tabuladores, pero no NUL ni
            # sustitutos UTF-16 que PostgreSQL/UTF-8 no puedan almacenar.
            require(len(item) <= 16384 and all(ord(c) != 0 and not 0xD800 <= ord(c) <= 0xDFFF for c in item))
        elif item is not None and type(item) is not bool:
            require(number(item))


def workspace(value):
    require(isinstance(value, dict))
    bounded_json(value, 128, 35000)
    require(len(encoded(value)) <= 1_500_000, "El área de bloques supera 1,5 MB.")
    if "blocks" not in value:
        return
    section = value["blocks"]
    require(isinstance(section, dict) and type(section.get("languageVersion")) is int and section["languageVersion"] == 0 and isinstance(section.get("blocks"), list))
    stack = list(section["blocks"])
    ids = set()
    while stack:
        block = stack.pop()
        require(isinstance(block, dict) and isinstance(block.get("type"), str) and block["type"] in BLOCKS, "Hay un tipo de bloque desconocido.")
        block_id = block.get("id")
        require(text(block_id, 128, 1) and block_id.strip() and block_id not in ids, "Hay identidades de bloques inválidas o repetidas.")
        ids.add(block_id)
        require(len(ids) <= 2000, "El proyecto supera 2000 bloques.")
        require("fields" not in block or isinstance(block["fields"], dict))
        if block["type"] == "capi_parallel":
            extra = block.get("extraState", {})
            require(isinstance(extra, dict))
            require("extraState" not in block or type(extra.get("branches")) is int)
            raw = extra.get("branches", block.get("fields", {}).get("BRANCHES", 2))
            require(type(raw) is int or isinstance(raw, str) and raw.isdigit())
            count = int(raw)
            require(2 <= count <= 16, "Al mismo tiempo admite entre 2 y 16 caminos.")
            field = block.get("fields", {}).get("BRANCHES")
            require(field is None or str(field) == str(count), "La cantidad de caminos no coincide.")
            require(isinstance(block.get("inputs", {}), dict))
            require(all(re.fullmatch(r"BRANCH\d+", name) and int(name[6:]) < count for name in block.get("inputs", {})), "Hay un camino fuera del bloque.")
        for coordinate in ("x", "y"):
            require(coordinate not in block or number(block[coordinate]))
        if "inputs" in block:
            require(isinstance(block["inputs"], dict))
            for connection in block["inputs"].values():
                require(isinstance(connection, dict))
                stack.extend(connection[key] for key in ("block", "shadow") if key in connection)
        if "next" in block:
            require(isinstance(block["next"], dict) and "block" in block["next"])
            stack.append(block["next"]["block"])


def scene(value):
    exact(value, ("schemaVersion", "id", "name", "description", "canvas", "devices", "widgets"), ("retiredDeviceIds", "sourceTemplate"))
    require(type(value["schemaVersion"]) is int and value["schemaVersion"] == 1 and identifier(value["id"]))
    require(text(value["name"], 60, 1) and value["name"].strip() and isinstance(value["description"], str))
    require("sourceTemplate" not in value or value["sourceTemplate"] in ("traffic", "robot", "wifi", "counter"))
    canvas = value["canvas"]
    exact(canvas, ("width", "height", "background", "gridSize", "snapToGrid"))
    require(number(canvas["width"], 0.01, 4096) and number(canvas["height"], 0.01, 4096) and number(canvas["gridSize"], 0.01, 512))
    require(canvas["background"] in ("park", "workshop", "home", "pond", "blank") and type(canvas["snapToGrid"]) is bool)
    require(isinstance(value["devices"], list) and isinstance(value["widgets"], list) and len(value["devices"]) + len(value["widgets"]) <= 256 and len(value["widgets"]) <= 1)
    ids, names = set(), set()
    for is_widget, items in ((False, value["devices"]), (True, value["widgets"])):
        for item in items:
            exact(item, ("schemaVersion", "id", "kind", "name", "position", "config") if is_widget else ("schemaVersion", "id", "kind", "name", "position", "config", "pins", "rotation"))
            require(identifier(item["id"]) and item["id"] not in ids and type(item["schemaVersion"]) is int and item["schemaVersion"] == 1)
            ids.add(item["id"])
            require(text(item["name"], 60, 1) and item["name"].strip())
            name = re.sub(r"\s+", " ", re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFKD", item["name"]))).strip().lower()
            require(name not in names, "Los componentes necesitan nombres distintos.")
            names.add(name)
            position = item["position"]
            exact(position, ("x", "y"))
            require(number(position["x"], 0, canvas["width"]) and number(position["y"], 0, canvas["height"]))
            kind = item["kind"]
            require(isinstance(kind, str) and (kind == "counter" if is_widget else kind in PINS))
            config = item["config"]
            exact(config, CONFIGS[kind])
            for key, rule in CONFIGS[kind].items():
                setting = config[key]
                require(type(setting) is bool if rule is bool else number(setting, *rule) if isinstance(rule, tuple) else text(setting, rule) if type(rule) is int else setting in rule)
            if not is_widget:
                require(number(item["rotation"], 0, 360) and item["rotation"] < 360)
                exact(item["pins"], PINS[kind])
                require(all(pin is None or (type(pin) is int and -2147483648 <= pin <= 2147483647) for pin in item["pins"].values()))
    retired = value.get("retiredDeviceIds", [])
    require(isinstance(retired, list) and len(retired) <= 4096)
    retired_ids = set()
    for key in retired:
        require(identifier(key) and key not in ids and key not in retired_ids)
        retired_ids.add(key)


def document(value):
    bounded_json(value)
    exact(value, ("application", "schemaVersion", "metadata", "target", "scene", "simulation", "workspace"))
    require(value["application"] == "CapiBloques" and type(value["schemaVersion"]) is int and value["schemaVersion"] == 2, "Importá el JSON v1/v2 desde el editor para convertirlo al formato actual.")
    require(value["target"] == TARGET, "El perfil de placa no es compatible.")
    exact(value["metadata"], ("title", "locale", "updatedAt"), ("migratedFrom",))
    title(value["metadata"]["title"])
    require(value["metadata"]["locale"] == "es-AR" and text(value["metadata"]["updatedAt"], 64, 1))
    require("migratedFrom" not in value["metadata"] or (type(value["metadata"]["migratedFrom"]) is int and value["metadata"]["migratedFrom"] == 1))
    exact(value["simulation"], ("scene", "speed"))
    require(value["simulation"]["scene"] in ("traffic", "robot", "wifi", "counter") and number(value["simulation"]["speed"], 0.25, 4))
    scene(value["scene"])
    workspace(value["workspace"])
    size = len(encoded(value))
    require(size <= MAX_FILE_BYTES, "El proyecto supera 2 MB.")
    return size
