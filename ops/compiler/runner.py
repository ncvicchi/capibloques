"""Trusted host orchestrator. Install root-owned; never inside the API/compiler.

Container lifetime is authoritative. Losing a lease/CLI/runner does NOT prove
termination. Reconcile Docker before acknowledging completion or freeing a slot.
"""
import base64
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
import uuid
import zipfile

ROOT = Path("/var/lib/capibloques-compiler/artifacts")
CONFIG = Path("/etc/capibloques-compiler.json")
LABEL = "com.capibloques.compiler=1"
MAX_OUTPUT = 6_800_000
DEADLINE = 1800
STOP = threading.Event()


def docker(*args, maximum=4_096):
    result = subprocess.run(["docker", *args], capture_output=True, timeout=30)
    if result.returncode or len(result.stdout) > maximum:
        raise RuntimeError("Docker unavailable")
    return result.stdout


def dispatch(configuration, action, data=None):
    command = ["docker", "compose", "--ansi", "never", "-f", "compose.dev.yaml", "-f", "compose.backend.dev.yaml", "exec", "-T", "api", "python", "manage.py", "compiler_dispatch", action]
    result = subprocess.run(command, cwd=configuration["checkout"], input=json.dumps(data or {}).encode(), capture_output=True, timeout=20)
    if result.returncode or len(result.stdout) > 2_100_000:
        raise RuntimeError("Queue unavailable")
    return json.loads(result.stdout)


def name(attempt):
    return "capi-build-" + str(uuid.UUID(attempt))


def inventory():
    ids = docker("ps", "-aq", "--filter", "label=" + LABEL).decode().split()
    result = {}
    for cid in ids:
        detail = json.loads(docker("inspect", cid, maximum=100_000))[0]
        container_name = detail["Name"].lstrip("/")
        if not re.fullmatch(r"capi-build-[0-9a-f-]{36}", container_name):
            raise RuntimeError("Unexpected managed container")
        result[container_name] = detail
    return result


def terminate(container_name):
    # Enumeration must succeed; a failed inspect is not evidence of absence.
    info = inventory().get(container_name)
    if info is None:
        return {"ExitCode": -1, "OOMKilled": False}
    if info["State"]["Running"]:
        docker("kill", container_name)
        info = inventory().get(container_name)
    if info is None or info["State"]["Running"]:
        raise RuntimeError("Termination not confirmed")
    state = info["State"]
    docker("rm", container_name)
    return state


def create_arguments(attempt, image):
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image):
        raise ValueError("Image must be immutable")
    return ["create", "-i", "--name", name(attempt), "--label", LABEL,
            "--network", "none", "--read-only", "--user", "10000:10000", "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true", "--pids-limit", "128", "--cpus", "0.60",
            "--memory", "1024m", "--memory-swap", "1600m", "--ulimit", "nofile=256:256",
            "--tmpfs", "/work:rw,exec,nosuid,nodev,size=768m,uid=10000,gid=10000,mode=0700",
            "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=128m,mode=1777", "--log-driver", "none", image]


def memory_peak(info):
    try:
        pid = int(info["State"]["Pid"])
        group = next(line[3:] for line in Path(f"/proc/{pid}/cgroup").read_text().splitlines() if line.startswith("0::"))
        path = (Path("/sys/fs/cgroup") / group.lstrip("/") / "memory.peak").resolve()
        if not path.is_relative_to(Path("/sys/fs/cgroup")):
            return 0
        return int(path.read_text())
    except (OSError, ValueError, StopIteration, KeyError):
        return 0


def read_output(process, result):
    try:
        output = bytearray()
        while chunk := process.stdout.read(8192):
            output.extend(chunk)
            if len(output) > MAX_OUTPUT:
                result["overflow"] = True
                return
        result["output"] = bytes(output)
    except Exception:
        result["overflow"] = True
    finally:
        result["done"] = True


def validate_archive(raw, job):
    if not 0 < len(raw) <= 5_000_000:
        raise ValueError
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if not 5 <= len(entries) <= 12 or len({e.filename for e in entries}) != len(entries):
            raise ValueError
        if any(e.compress_type != zipfile.ZIP_STORED or e.file_size > 4_194_304 for e in entries):
            raise ValueError
        metadata = json.loads(archive.read("manifest.json"))
        if metadata.get("format") != "CapiBloquesFirmware" or metadata.get("version") != 1 or metadata.get("chip") != "esp32" or metadata.get("board") != "wemos-d1-r32" or metadata.get("framework") != job["framework"]:
            raise ValueError
        if metadata.get("containsWifiCredentials") != bool(job["wifi"]):
            raise ValueError
        parts = metadata.get("parts", [])
        if not 3 <= len(parts) <= 5:
            raise ValueError
        allowed = {"manifest.json", "LEEME.txt", "licenses/Adafruit-GFX.txt", "licenses/Arduino-GFX.txt"}
        last = 0
        for index, part in enumerate(parts):
            expected = f"firmware/part-{index}.bin"
            if part.get("path") != expected or type(part.get("offset")) is not int or part["offset"] < last:
                raise ValueError
            value = archive.read(expected)
            last = part["offset"] + len(value)
            if not value or last > 4_194_304 or len(value) != part.get("size") or hashlib.sha256(value).hexdigest() != part.get("sha256"):
                raise ValueError
            allowed.add(expected)
        if any(e.filename not in allowed for e in entries):
            raise ValueError
        # Bind downloadable metadata to this exact immutable attempt/recipe.
        metadata.update({"buildId": job["id"], "attemptId": job["attempt"], "recipe": job["recipe"]})
        result = io.BytesIO()
        with zipfile.ZipFile(result, "w", compression=zipfile.ZIP_STORED) as output:
            for entry in entries:
                output.writestr(entry, json.dumps(metadata, indent=2).encode() if entry.filename == "manifest.json" else archive.read(entry))
        return result.getvalue()


def publish(raw, job):
    raw = validate_archive(raw, job)
    stem = str(uuid.UUID(job["attempt"]))
    temporary, target = ROOT / (stem + ".tmp"), ROOT / (stem + ".zip")
    if temporary.exists() and not temporary.is_symlink():
        temporary.unlink()  # Only this verified attempt's incomplete artifact.
    with temporary.open("xb") as file:
        os.chmod(temporary, 0o600); os.chown(temporary, 1000, 1000)
        file.write(raw); file.flush(); os.fsync(file.fileno())
    temporary.replace(target)
    return hashlib.sha256(raw).hexdigest()


def cleanup(references):
    # Only verified generated UUID files in this fixed artifact directory.
    for path in ROOT.iterdir():
        if path.is_symlink() or not re.fullmatch(r"[0-9a-f-]{36}\.(zip|tmp)", path.name):
            continue
        uuid.UUID(path.stem)
        if path.stem not in references and time.time() - path.stat().st_mtime > 60:
            path.unlink()


def main():
    configuration = json.loads(CONFIG.read_text())
    image = configuration["image"]
    active = {}
    while not STOP.is_set():
        try:
            snapshot = dispatch(configuration, "inspect")
            containers = inventory()
            expected = {name(job["attempt"]): job for job in snapshot["active"]}
            current_attempts = {job["attempt"] for job in snapshot["active"]}
            for attempt in list(active.keys() - current_attempts):
                terminate(name(attempt))
                active[attempt]["process"].wait(timeout=5)
                del active[attempt]  # Includes secret input; handles lost finish ACK.
            # Crash recovery: kill old attempts before acknowledging failure.
            for container_name in containers.keys() - expected.keys():
                terminate(container_name)
            for job in snapshot["active"]:
                container_name = name(job["attempt"])
                current = active.get(job["attempt"])
                if current is None:
                    state = terminate(container_name)
                    dispatch(configuration, "finish", {**job, "terminated": True, "success": False, "reason": "restart", "metrics": {"oomKilled": state["OOMKilled"]}})
                    continue
                elapsed = time.monotonic() - current["start"]
                current["peakMemoryBytes"] = max(current.get("peakMemoryBytes", 0), memory_peak(containers.get(container_name, {})))
                if job["cancel"] or elapsed > DEADLINE or current.get("done") or current.get("overflow"):
                    state = terminate(container_name)
                    result = {**job, "terminated": True, "success": False, "reason": "timeout" if elapsed > DEADLINE else "resources" if state["OOMKilled"] else "generation",
                              "metrics": {"seconds": round(elapsed, 1), "peakMemoryBytes": current["peakMemoryBytes"], "oomKilled": state["OOMKilled"], "exitCode": state["ExitCode"]}}
                    if not job["cancel"] and elapsed <= DEADLINE and not state["OOMKilled"] and current.get("output") and not current.get("overflow"):
                        try:
                            output = json.loads(current["output"])
                            if not isinstance(output, dict):
                                raise ValueError("Invalid compiler result")
                            if state["ExitCode"] == 0 and output.get("success") is True:
                                raw = base64.b64decode(output["artifact"], validate=True)
                                result.update(success=True, sha256=publish(raw, current["job"]))
                            elif output.get("reason") in ("generation", "toolchain", "artifact"):
                                result["reason"] = output["reason"]
                        except (ValueError, KeyError, OSError, zipfile.BadZipFile):
                            result["reason"] = "artifact"
                    dispatch(configuration, "finish", result)
                    current["process"].wait(timeout=5)
                    del active[job["attempt"]]
                else:
                    dispatch(configuration, "heartbeat", job)
            cleanup(set(snapshot["artifacts"]))
            claim = dispatch(configuration, "claim")["job"]
            if claim:
                # Recipe is immutable image ID; queued old recipes are rejected.
                if claim["recipe"] != image.removeprefix("sha256:"):
                    dispatch(configuration, "finish", {"id": claim["id"], "attempt": claim["attempt"], "terminated": True, "success": False, "reason": "restart"})
                else:
                    docker(*create_arguments(claim["attempt"], image))
                    process = subprocess.Popen(["docker", "start", "-ai", name(claim["attempt"])], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                    current = {"process": process, "job": claim, "start": time.monotonic()}
                    active[claim["attempt"]] = current
                    threading.Thread(target=read_output, args=(process, current), daemon=True).start()
                    # Never put credentials in arguments, environment or files.
                    process.stdin.write(json.dumps({"framework": claim["framework"], "document": claim["document"], "wifi": claim["wifi"]}, ensure_ascii=False).encode())
                    process.stdin.close()
                    print("Compiler attempt started", flush=True)
        except Exception:
            # Fail closed; retain DB slots. Next cycle reconciles known containers.
            print("Compiler waiting for safe reconciliation", flush=True)
        finally:
            # Python loop locals otherwise retain the last finished job/secret
            # and decoded firmware indefinitely while the queue is idle. Active
            # attempts retain their inputs only in `active` for reconciliation.
            claim = current = raw = output = None
        STOP.wait(5)
    for attempt in active:
        try:
            terminate(name(attempt))
        except Exception:
            pass  # Next startup reconciles; never claim a freed slot here.


if __name__ == "__main__":
    lock = open("/run/capibloques-compiler.lock", "w")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    signal.signal(signal.SIGTERM, lambda *_: STOP.set())
    signal.signal(signal.SIGINT, lambda *_: STOP.set())
    main()
