"""Untrusted compiler container: no DB credentials, network or host mounts."""
import base64
import json
from pathlib import Path
import subprocess
import sys
from archive import bundle


def run(command, *, input=None, cwd=None, maximum=2_100_000, structured=False):
    process = subprocess.Popen(command, stdin=subprocess.PIPE if input else subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL if structured else subprocess.STDOUT, cwd=cwd)
    if input:
        # Generator input is bounded; its output is emitted only after all stdin.
        process.stdin.write(input); process.stdin.close()
    result = bytearray()
    while chunk := process.stdout.read(8192):
        result.extend(chunk)
        if len(result) > maximum:
            process.kill(); process.wait()
            raise ValueError("Bounded compiler output exceeded")
    code = process.wait()
    if code:
        raise ValueError("Compilation failed")
    return bytes(result)


def main():
    payload = sys.stdin.buffer.read(2_100_001)
    if len(payload) > 2_100_000:
        raise ValueError
    data = json.loads(payload)
    framework = data["framework"]
    if framework not in ("arduino", "esp-idf"):
        raise ValueError
    Path("/work/home").mkdir()
    Path("/work/project").mkdir()
    generated = json.loads(run(["node", "--experimental-strip-types", "/opt/capi/scripts/compiler-generate.mjs"], input=payload, structured=True))
    for name, text in generated["files"].items():
        path = (Path("/work/project") / name).resolve()
        if not path.is_relative_to(Path("/work/project")):
            raise ValueError
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    # Captured output is bounded and NEVER returned: compiler diagnostics may
    # include source lines/passwords. Only a fixed stage/error reaches the host.
    if framework == "esp-idf":
        run(["bash", "-c", '. /opt/esp/idf/export.sh >/dev/null && idf.py -C /work/project -B /work/build -DIDF_TARGET=esp32 build'], maximum=4_000_000)
    else:
        run(["arduino-cli", "--config-file", "/opt/arduino/arduino-cli.yaml", "compile", "--fqbn", "esp32:esp32:d1_uno32:FlashFreq=40", "--jobs", "1", "--build-path", "/work/build", "/work/project/capibloques"], maximum=4_000_000)
    archive = bundle("/work/build", framework, generated["usesWifi"])
    print(json.dumps({"success": True, "artifact": base64.b64encode(archive).decode()}))


try:
    main()
except Exception:
    # Intentional redaction, including dependency exception context.
    print(json.dumps({"success": False, "reason": "generation"}))
    sys.exit(1)
