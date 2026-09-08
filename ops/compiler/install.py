"""Explicit DEV installer. Never run on a gateway, PRD or arbitrary host."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess

if os.getuid() != 0 or socket.gethostname() != "capi-dev":
    raise SystemExit("Only root on capi-dev may install this DEV runner")
checkout = Path(__file__).resolve().parents[2]
image = subprocess.check_output(["docker", "image", "inspect", "capibloques-compiler-dev:phase9", "--format", "{{.Id}}"], text=True).strip()
if not image.startswith("sha256:") or len(image) != 71:
    raise SystemExit("No immutable compiler image")
subprocess.run(["systemctl", "stop", "capibloques-compiler.service"], check=False, capture_output=True)
destination = Path("/opt/capibloques-compiler")
destination.mkdir(mode=0o755, exist_ok=True)
shutil.copy2(checkout / "ops/compiler/runner.py", destination / "runner.py")
os.chmod(destination / "runner.py", 0o644); os.chown(destination / "runner.py", 0, 0)
artifacts = Path("/var/lib/capibloques-compiler/artifacts")
artifacts.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chown(artifacts, 1000, 1000); os.chmod(artifacts, 0o700)
configuration = Path("/etc/capibloques-compiler.json")
configuration.write_text(json.dumps({"checkout": str(checkout), "image": image}))
os.chmod(configuration, 0o600); os.chown(configuration, 0, 0)
shutil.copy2(checkout / "ops/compiler/capibloques-compiler.service", "/etc/systemd/system/capibloques-compiler.service")
subprocess.run(["systemctl", "daemon-reload"], check=True)
print("Runner installed, NOT enabled yet. Reconcile old attempts, register image, then enable the service.")
print("Recipe: " + image.removeprefix("sha256:"))
