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
TARGETS = {
    "wemos-d1-r32": {"family": "esp32", "framework": "arduino", "coreMajor": 3, "coreVersion": "3.3.11", "boardProfile": "wemos-d1-r32", "fqbn": "esp32:esp32:d1_uno32"},
    "diymall-esp32-s3-devkitc-v1-n16r8": {"family": "esp32-s3", "framework": "arduino", "coreMajor": 3, "coreVersion": "3.3.11", "boardProfile": "diymall-esp32-s3-devkitc-v1-n16r8", "fqbn": "esp32:esp32:esp32s3"},
}
BOARD_PINS = {
    "wemos-d1-r32": {4, 13, 14, 16, 17, 18, 19, 23, 25, 26, 27, 34, 35, 36, 39},
    # N16R8: GPIO35-37 belong to the Octal PSRAM and are intentionally unavailable.
    "diymall-esp32-s3-devkitc-v1-n16r8": {0, 1, 2, 3, *range(4, 22), *range(38, 49)},
}
BLOCKS = {"capi_" + name for name in ("start", "forever", "repeat", "wait", "if", "compare", "counter_compare", "counter_set", "counter_change", "traffic", "led", "pin_write", "robot", "otto", "motor", "servo", "buzzer", "tone", "button_pressed", "sensor_compare", "wifi_connect", "wifi_connected", "serial")}
BLOCKS.add("capi_parallel")
BLOCKS.update(("capi_display_write", "capi_display_clear", "capi_display_animate_text", "capi_display_artwork", "capi_display_button_pressed", "capi_visual_wait"))
BLOCKS.update(("capi_message_send", "capi_message_receive"))
BLOCKS.update(("capi_matrix_clear", "capi_matrix_pixel", "capi_matrix_pattern", "capi_matrix_scroll"))
BLOCKS.update(("capi_variable_set_number", "capi_variable_change", "capi_variable_set_text", "capi_variable_set_boolean", "capi_variable_get_number", "capi_variable_get_text", "capi_variable_get_boolean", "capi_value_number", "capi_value_text", "capi_value_boolean", "capi_counter_value", "capi_sensor_value", "capi_message_value", "capi_number_math", "capi_text_join"))
BLOCKS.add("capi_value_compare")
BLOCKS.add("capi_barrier_state")
PINS = {"trafficLight": ["red", "yellow", "green"], "robot": ["leftIn1", "leftIn2", "rightIn1", "rightIn2"], "otto": ["leftLeg", "rightLeg", "leftFoot", "rightFoot"], "motor": ["in1", "in2"], **{kind: ["signal"] for kind in ("led", "servo", "activeBuzzer", "passiveBuzzer", "button", "infraredBarrier", "lightSensor", "potentiometer")}, "wifiNode": []}
CONFIGS = {
    "trafficLight": {"redBrightness": (0, 100), "yellowBrightness": (0, 100), "greenBrightness": (0, 100)},
    "robot": {"speed": (0, 100), "heading": (-360000, 360000), "color": 64},
    "otto": {"profile": ["biped4"]},
    "motor": {"power": (0, 100), "driver": ["DRV8833"]}, "led": {"brightness": (0, 100), "color": 64},
    "servo": {"angle": (0, 180)}, "activeBuzzer": {"enabled": bool},
    "passiveBuzzer": {"frequency": (20, 20000), "durationMs": (10, 60000)},
    "button": {"pressed": bool, "pullup": bool}, "lightSensor": {"value": (0, 4095)}, "potentiometer": {"value": (0, 4095)},
    "infraredBarrier": {"interrupted": bool, "interruptedLevel": ["HIGH", "LOW"]},
    "wifiNode": {"status": ["idle", "connecting", "connected", "error"], "ssid": 64},
    "counter": {"value": (-1e308, 1e308), "mascot": 32},
}
PINS["display"] = ["sda", "scl", "sck", "mosi", "cs", "dc", "rst", "rs", "en", "d4", "d5", "d6", "d7", "backlight", "keys"]
LEGACY_DISPLAY_PINS = {"sda", "scl", "sck", "mosi", "cs", "dc", "rst"}
PINS["messages"] = ["tx", "rx"]
PINS["ledMatrix"] = ["din", "clk", "cs"]
CONFIGS["messages"] = {"mode": ["send", "receive", "both"], "baudRate": [9600, 19200, 38400, 57600, 115200]}
DISPLAY_PROFILES = {"lcd1602keypad": (16, 2, False, "parallel"), "lcd1602": (16, 2, False, "i2c"), "lcd2004": (20, 4, False, "i2c"), "ssd1306": (16, 8, True, "i2c"), "ili9341": (26, 15, True, "spi"), "ili9488": (40, 20, True, "spi")}


def display_config(config):
    legacy = set(config) == {"profile", "address", "areas", "retiredAreaIds"} if isinstance(config, dict) else False
    exact(config, ("profile", "address", "areas", "retiredAreaIds"), ("animationSpeed", "artworks", "retiredArtworkIds"))
    require(legacy or set(config) == {"profile", "address", "areas", "retiredAreaIds", "animationSpeed", "artworks", "retiredArtworkIds"})
    require(isinstance(config["profile"], str) and config["profile"] in DISPLAY_PROFILES)
    columns, rows, graphic, bus = DISPLAY_PROFILES[config["profile"]]
    require(type(config["address"]) is int and (config["address"] == 0 if bus in ("spi", "parallel") else config["address"] in ([0x3c, 0x3d] if config["profile"] == "ssd1306" else [*range(0x20, 0x28), *range(0x38, 0x40)])))
    areas, retired = config["areas"], config["retiredAreaIds"]
    require(isinstance(areas, list) and len(areas) <= 8 and (graphic or not areas))
    require(isinstance(retired, list) and len(retired) <= 4096)
    ids, names = {"screen"}, set()
    for area in areas:
        exact(area, ("id", "name", "column", "row", "columns", "rows"))
        require(identifier(area["id"]) and area["id"] not in ids and text(area["name"], 40, 1) and area["name"].strip())
        name = re.sub(r"\s+", " ", re.sub(r"[\u0300-\u036f]", "", unicodedata.normalize("NFKD", area["name"]))).strip().lower()
        require(name not in names)
        ids.add(area["id"])
        names.add(name)
        require(all(type(area[key]) is int for key in ("column", "row", "columns", "rows")))
        require(0 <= area["column"] < columns and 0 <= area["row"] < rows and 1 <= area["columns"] <= columns - area["column"] and 1 <= area["rows"] <= rows - area["row"])
    for index, area in enumerate(areas):
        require(not any(area["column"] < other["column"] + other["columns"] and other["column"] < area["column"] + area["columns"] and area["row"] < other["row"] + other["rows"] and other["row"] < area["row"] + area["rows"] for other in areas[index + 1:]))
    for key in retired:
        require(identifier(key) and key not in ids)
        ids.add(key)
    if not legacy:
        require(config["animationSpeed"] in ("slow", "normal", "fast"))
        artworks, retired_artworks = config["artworks"], config["retiredArtworkIds"]
        require(isinstance(artworks, list) and len(artworks) <= 12 and (graphic or not artworks))
        require(isinstance(retired_artworks, list) and len(retired_artworks) <= 4096)
        artwork_ids, artwork_names = set(), set()
        for artwork in artworks:
            exact(artwork, ("id", "name", "rows"))
            require(isinstance(artwork["id"], str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", artwork["id"]) and artwork["id"] not in artwork_ids)
            normalized = artwork["name"].strip().lower() if isinstance(artwork["name"], str) else ""
            require(text(artwork["name"], 30, 1) and normalized and normalized not in artwork_names)
            require(isinstance(artwork["rows"], list) and len(artwork["rows"]) == 8 and all(type(row) is int and 0 <= row <= 0xffff for row in artwork["rows"]))
            artwork_ids.add(artwork["id"]); artwork_names.add(normalized)
        for artwork_id in retired_artworks:
            require(isinstance(artwork_id, str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", artwork_id) and artwork_id not in artwork_ids)
            artwork_ids.add(artwork_id)
    return ["sda", "scl"] if bus == "i2c" else ["rs", "en", "d4", "d5", "d6", "d7", "backlight", "keys"] if bus == "parallel" else ["sck", "mosi", "cs", "dc", "rst"]


def matrix_config(config):
    exact(config, ("brightness", "order", "orientation", "patterns"))
    require(type(config["brightness"]) is int and 0 <= config["brightness"] <= 15)
    require(config["order"] in ("left-to-right", "right-to-left") and config["orientation"] in ("normal", "rotated"))
    patterns = config["patterns"]
    require(isinstance(patterns, list) and 1 <= len(patterns) <= 12)
    ids, names = set(), set()
    for pattern in patterns:
        exact(pattern, ("id", "name", "rows"))
        require(isinstance(pattern["id"], str) and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", pattern["id"]) and pattern["id"] not in ids)
        normalized = pattern["name"].strip().lower() if isinstance(pattern["name"], str) else ""
        require(text(pattern["name"], 30, 1) and normalized and normalized not in names)
        require(isinstance(pattern["rows"], list) and len(pattern["rows"]) == 8 and all(type(row) is int and 0 <= row <= 0xffffffff for row in pattern["rows"]))
        ids.add(pattern["id"]); names.add(normalized)


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
    variables = value.get("variables", [])
    require(isinstance(variables, list) and len(variables) <= 32)
    variable_ids, variable_names = set(), set()
    for variable in variables:
        require(isinstance(variable, dict) and set(variable) == {"name", "id", "type"})
        require(text(variable["id"], 128, 1) and variable["id"].strip() and variable["id"] not in variable_ids)
        require(text(variable["name"], 32, 1) and variable["name"].strip())
        normalized = unicodedata.normalize("NFKD", variable["name"]).casefold()
        require(normalized not in variable_names and variable["type"] in ("Number", "String", "Boolean"))
        variable_ids.add(variable["id"]); variable_names.add(normalized)
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


def scene(value, board_profile="wemos-d1-r32"):
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
    display_count = 0
    messages_count = 0
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
            if kind == "display":
                display_count += 1
                require(display_count <= 1, "Cada proyecto admite una sola pantalla o matriz.")
                used_pins = display_config(config)
                require(isinstance(item["pins"], dict) and all(item["pins"].get(key) is None for key in PINS[kind] if key not in used_pins))
                require(set(item["pins"]) == set(PINS[kind]) or (config["profile"] != "lcd1602keypad" and set(item["pins"]) == LEGACY_DISPLAY_PINS))
            elif kind == "ledMatrix":
                display_count += 1
                require(display_count <= 1, "Cada proyecto admite una sola pantalla o matriz.")
                matrix_config(config)
            else:
                if kind == "messages":
                    messages_count += 1
                    require(messages_count <= 2, "La placa admite hasta dos componentes Mensajes.")
                if kind == "otto":
                    exact(config, ("profile", "centers", "reversed"))
                    require(isinstance(config["centers"], list) and len(config["centers"]) == 4 and all(type(value) is int and 45 <= value <= 135 for value in config["centers"]))
                    require(isinstance(config["reversed"], list) and len(config["reversed"]) == 4 and all(type(value) is bool for value in config["reversed"]))
                else:
                    exact(config, (*CONFIGS[kind], "messages") if kind == "messages" else CONFIGS[kind])
            for key, rule in CONFIGS.get(kind, {}).items():
                setting = config[key]
                require(type(setting) is bool if rule is bool else number(setting, *rule) if isinstance(rule, tuple) else text(setting, rule) if type(rule) is int else setting in rule)
            if kind == "messages":
                messages = config["messages"]
                require(isinstance(messages, list) and 1 <= len(messages) <= 24 and len(set(messages)) == len(messages))
                require(all(text(message, 120, 1) and message.strip() and len(message.encode("utf-8")) <= 120 for message in messages))
                require(config["mode"] != "send" or item["pins"]["rx"] is None)
                require(config["mode"] != "receive" or item["pins"]["tx"] is None)
            if not is_widget:
                require(number(item["rotation"], 0, 360) and item["rotation"] < 360)
                if kind != "display":
                    exact(item["pins"], PINS[kind])
                require(all(pin is None or (type(pin) is int and -2147483648 <= pin <= 2147483647) for pin in item["pins"].values()))
                require(all(pin is None or pin in BOARD_PINS[board_profile] for pin in item["pins"].values()), "La escena usa un GPIO que no pertenece a la placa elegida.")
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
    target = value["target"]
    require(isinstance(target, dict) and target.get("boardProfile") in TARGETS and target == TARGETS[target["boardProfile"]], "El perfil de placa no es compatible.")
    exact(value["metadata"], ("title", "locale", "updatedAt"), ("migratedFrom",))
    title(value["metadata"]["title"])
    require(value["metadata"]["locale"] == "es-AR" and text(value["metadata"]["updatedAt"], 64, 1))
    require("migratedFrom" not in value["metadata"] or (type(value["metadata"]["migratedFrom"]) is int and value["metadata"]["migratedFrom"] == 1))
    exact(value["simulation"], ("scene", "speed"))
    require(value["simulation"]["scene"] in ("traffic", "robot", "wifi", "counter") and number(value["simulation"]["speed"], 0.25, 4))
    scene(value["scene"], target["boardProfile"])
    workspace(value["workspace"])
    size = len(encoded(value))
    require(size <= MAX_FILE_BYTES, "El proyecto supera 2 MB.")
    return size
