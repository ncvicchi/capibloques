"""DEV-only synthetic diagnostic, never reads live projects or real credentials.

Uses the exact isolated image/limits with a separate probe label. Temporary
diagnostic instrumentation exposes bounded tool output ONLY for bundled fixtures.
"""
import json
from pathlib import Path
import socket
import subprocess
import sys
import uuid

from runner import create_arguments

if socket.gethostname() != "capi-dev": raise SystemExit("DEV only")
framework = sys.argv[1]
if framework not in ("arduino", "esp-idf"): raise SystemExit("Invalid framework")
checkout = Path(__file__).resolve().parents[2]
image = subprocess.check_output(["docker", "image", "inspect", "capibloques-compiler-dev:phase9", "--format", "{{.Id}}"], text=True).strip()
attempt = str(uuid.uuid4())
args = create_arguments(attempt, image)
args[args.index("--label") + 1] = "com.capibloques.compiler-probe=1"
container = "capi-probe-" + attempt
args[args.index("--name") + 1] = container
code = '''
from pathlib import Path
import sys, json, base64, traceback
sys.path.insert(0, '/opt/capi')
source = Path('/opt/capi/entry.py').read_text().split('\\ntry:\\n    main()')[0]
source = source.replace('raise ValueError("Compilation failed")', 'raise ValueError(result[-12000:].decode("utf-8", errors="replace"))')
source = source.replace('structured=True', 'structured=False')
namespace = {}
exec(compile(source, '/opt/capi/entry.py', 'exec'), namespace)
def safe_print(value):
    data = json.loads(value)
    print(json.dumps({'success': data.get('success'), 'bytes': len(base64.b64decode(data.get('artifact', '')))}))
namespace['print'] = safe_print
try: namespace['main']()
except Exception: traceback.print_exc(limit=4)
'''
args[-1:] = ["--entrypoint", "python", image, "-c", code]
subprocess.run(["docker", *args], check=True, stdout=subprocess.DEVNULL)
fixture = json.loads((checkout / "backend/tests/fixtures/projects-v2.json").read_text())[0]
try:
    result = subprocess.run(["docker", "start", "-ai", container], input=json.dumps({"framework": framework, "document": fixture, "wifi": None}).encode(), capture_output=True, timeout=1800)
    print((result.stdout + result.stderr)[-16000:].decode(errors="replace"))
finally:
    subprocess.run(["docker", "kill", container], capture_output=True, timeout=30)
    subprocess.run(["docker", "rm", container], check=True, capture_output=True, timeout=30)
