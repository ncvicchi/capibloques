#!/usr/bin/env python3
"""Supervisa, despliega y revierte el frontend estático de capi-dev."""
import argparse
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time


ENV_FILE = Path("/etc/capibloques/public-dev.env")
WEB_UNIT = "capibloques-dev-web.service"
IMAGE = "capibloques-editor-dev"
TAG = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")


def require_dev_root():
    if os.getuid() != 0 or socket.gethostname() != "capi-dev":
        raise SystemExit("Sólo root en capi-dev puede operar este runtime DEV")


def read_environment(path=ENV_FILE):
    values = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw or raw.startswith("#"):
            continue
        if "=" not in raw:
            raise SystemExit(f"Configuración inválida en línea {number}")
        key, value = raw.split("=", 1)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or key in values or "\x00" in value:
            raise SystemExit(f"Configuración inválida en línea {number}")
        values[key] = value
    required = {
        "CAPIBLOQUES_CHECKOUT", "CAPIBLOQUES_WEB_IMAGE_TAG", "CAPIBLOQUES_BUILD_REVISION",
        "CAPIBLOQUES_EDGE_IP", "CAPIBLOQUES_PUBLIC_BIND_IP", "CAPIBLOQUES_PUBLIC_PORT",
        "CAPIBLOQUES_API_RECREATE_REQUIRED",
    }
    if not required.issubset(values):
        raise SystemExit("La configuración privada está incompleta")
    return values


def require_current_api(values):
    state = values.get("CAPIBLOQUES_API_RECREATE_REQUIRED")
    if state not in ("true", "false"):
        raise SystemExit("CAPIBLOQUES_API_RECREATE_REQUIRED debe ser true o false")
    if state == "true":
        raise SystemExit("La frontera pública cambió; ejecutar deploy --with-api antes de abrir el listener")


def write_environment(values):
    content = "".join(f"{key}={value}\n" for key, value in values.items())
    temporary = ENV_FILE.with_name(f".{ENV_FILE.name}.{os.getpid()}.tmp")
    temporary.write_text(content, encoding="utf-8")
    os.chmod(temporary, 0o600)
    os.chown(temporary, 0, 0)
    os.replace(temporary, ENV_FILE)


def compose_command(checkout, env_file, *arguments):
    return [
        "docker", "compose", "--ansi", "never", "--env-file", str(env_file),
        "-f", str(checkout / "compose.dev.yaml"),
        "-f", str(checkout / "compose.backend.dev.yaml"),
        "-f", str(checkout / "compose.compiler.dev.yaml"),
        *arguments,
    ]


def compose(checkout, env_file, *arguments, check=True, **kwargs):
    return subprocess.run(compose_command(checkout, env_file, *arguments), check=check, **kwargs)


def temporary_environment(values):
    handle = tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", prefix="capibloques-public-", suffix=".env", dir="/run", delete=False,
    )
    try:
        handle.write("".join(f"{key}={value}\n" for key, value in values.items()))
        handle.close()
        os.chmod(handle.name, 0o600)
        return Path(handle.name)
    except Exception:
        Path(handle.name).unlink(missing_ok=True)
        raise


def wait_healthy(checkout, env_file, timeout=180):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = compose(checkout, env_file, "ps", "-q", "editor", text=True, capture_output=True)
        container = result.stdout.strip()
        if container:
            status = subprocess.check_output(
                ["docker", "inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", container],
                text=True,
            ).strip()
            if status == "healthy":
                return
            if status in ("exited", "dead", "unhealthy"):
                raise RuntimeError(f"editor quedó {status}")
        time.sleep(2)
    raise TimeoutError("editor no quedó saludable dentro del plazo")


def current_revision(checkout):
    if subprocess.check_output(["git", "-C", checkout, "status", "--porcelain"], text=True).strip():
        raise SystemExit("El checkout debe estar limpio antes de construir una versión desplegable")
    revision = subprocess.check_output(["git", "-C", checkout, "rev-parse", "HEAD"], text=True).strip()
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise SystemExit("Commit inválido")
    return revision


def image_exists(tag):
    return subprocess.run(
        ["docker", "image", "inspect", f"{IMAGE}:{tag}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode == 0


def image_revision(tag):
    try:
        revision = subprocess.check_output(
            ["docker", "image", "inspect", "--format", '{{index .Config.Labels "org.opencontainers.image.revision"}}', f"{IMAGE}:{tag}"],
            text=True,
        ).strip()
    except subprocess.CalledProcessError:
        raise SystemExit("La imagen de rollback no existe") from None
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise SystemExit("La imagen de rollback no declara una revisión Git válida")
    return revision


def ensure_build_window():
    if subprocess.run(
        ["systemctl", "is-active", "--quiet", "capibloques-compiler.service"],
        check=False,
    ).returncode == 0:
        raise SystemExit(
            "Pausá la admisión, esperá los trabajos y detené capibloques-compiler.service antes de construir"
        )
    active = subprocess.check_output(
        ["docker", "ps", "-q", "--filter", "label=com.capibloques.compiler=1"],
        text=True,
    ).strip()
    if active:
        raise SystemExit("Todavía hay un contenedor de compilación activo; no se inicia el builder Node")


def stop_web():
    subprocess.run(["systemctl", "stop", WEB_UNIT], check=False)


def quiesce_editor(checkout, env_file):
    # También cubre la primera migración, cuando el antiguo Node/HMR todavía no
    # estaba bajo capibloques-dev-web.service.
    compose(checkout, env_file, "stop", "--timeout", "15", "editor", check=False)


def start_web(checkout, env_file):
    subprocess.run(["systemctl", "enable", "--now", WEB_UNIT], check=True)
    wait_healthy(checkout, env_file)


def restore_frontend(previous, checkout):
    if not image_exists(previous):
        subprocess.run(["systemctl", "disable", WEB_UNIT], check=False)
        print(f"No existe la imagen anterior {previous}; el listener permanece detenido y deshabilitado", flush=True)
        return
    try:
        subprocess.run(["systemctl", "start", WEB_UNIT], check=True)
        wait_healthy(checkout, ENV_FILE)
    except Exception:
        stop_web()
        subprocess.run(["systemctl", "disable", WEB_UNIT], check=False)
        print(f"La imagen anterior {previous} tampoco quedó saludable; el listener fue deshabilitado", flush=True)


def deploy(values, with_api):
    checkout = Path(values["CAPIBLOQUES_CHECKOUT"]).resolve()
    revision = current_revision(checkout)
    candidate = revision[:12]
    if values["CAPIBLOQUES_API_RECREATE_REQUIRED"] == "true" and not with_api:
        raise SystemExit("Este cambio requiere capibloques-dev-runtime deploy --with-api")
    proposed = {
        **values,
        "CAPIBLOQUES_WEB_IMAGE_TAG": candidate,
        "CAPIBLOQUES_BUILD_REVISION": revision,
        "CAPIBLOQUES_API_RECREATE_REQUIRED": "false" if with_api else values["CAPIBLOQUES_API_RECREATE_REQUIRED"],
    }
    temporary = temporary_environment(proposed)
    previous = values["CAPIBLOQUES_WEB_IMAGE_TAG"]
    candidate_exists = image_exists(candidate)
    if candidate_exists and image_revision(candidate) != revision:
        temporary.unlink(missing_ok=True)
        raise SystemExit("La etiqueta candidata pertenece a otra revisión; no se sobrescribe")
    try:
        compose(checkout, temporary, "config", "--quiet")
        ensure_build_window()
        stop_web()
        quiesce_editor(checkout, ENV_FILE)
        # La VM tiene 2 GiB: ningún editor, ni siquiera el estático anterior,
        # se solapa con el builder Node de esta imagen.
        if not candidate_exists:
            compose(checkout, temporary, "build", "editor")
        if with_api:
            # Recrear la API cambia su frontera de confianza; la admisión de
            # compilaciones debe estar pausada antes de elegir esta opción.
            compose(
                checkout, temporary, "up", "-d", "--no-build", "--force-recreate",
                "--wait", "--wait-timeout", "120", "api",
            )
        write_environment(proposed)
        start_web(checkout, ENV_FILE)
    except Exception:
        stop_web()
        write_environment(values)
        restore_frontend(previous, checkout)
        raise
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Frontend DEV saludable en {candidate}")


def rollback(values, tag):
    require_current_api(values)
    if not TAG.fullmatch(tag) or not image_exists(tag):
        raise SystemExit("La etiqueta solicitada no existe localmente")
    checkout = Path(values["CAPIBLOQUES_CHECKOUT"]).resolve()
    previous = values["CAPIBLOQUES_WEB_IMAGE_TAG"]
    proposed = {
        **values,
        "CAPIBLOQUES_WEB_IMAGE_TAG": tag,
        "CAPIBLOQUES_BUILD_REVISION": image_revision(tag),
    }
    stop_web()
    try:
        write_environment(proposed)
        start_web(checkout, ENV_FILE)
    except Exception:
        stop_web()
        write_environment(values)
        restore_frontend(previous, checkout)
        raise
    print(f"Frontend restaurado a {tag}; backend y checkout no fueron modificados")


def supervise(values):
    require_current_api(values)
    checkout = Path(values["CAPIBLOQUES_CHECKOUT"]).resolve()
    os.execvp("docker", compose_command(checkout, ENV_FILE, "up", "--no-build", "--no-deps", "editor"))


def stop(values):
    checkout = Path(values["CAPIBLOQUES_CHECKOUT"]).resolve()
    compose(checkout, ENV_FILE, "stop", "--timeout", "15", "editor", check=False)


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    deploy_parser = commands.add_parser("deploy")
    deploy_parser.add_argument("--with-api", action="store_true", help="recrea API; usar sólo con admisión pausada")
    commands.add_parser("status")
    commands.add_parser("validate")
    commands.add_parser("supervise", help=argparse.SUPPRESS)
    commands.add_parser("stop", help=argparse.SUPPRESS)
    rollback_parser = commands.add_parser("rollback")
    rollback_parser.add_argument("tag")
    args = parser.parse_args()
    values = read_environment()
    checkout = Path(values["CAPIBLOQUES_CHECKOUT"]).resolve()
    if args.command == "deploy":
        deploy(values, args.with_api)
    elif args.command == "rollback":
        rollback(values, args.tag)
    elif args.command == "validate":
        require_current_api(values)
        compose(checkout, ENV_FILE, "config", "--quiet")
        subprocess.run(["/usr/local/sbin/capibloques-dev-firewall", "status"], check=True)
        print("Compose y firewall válidos")
    elif args.command == "status":
        subprocess.run(["systemctl", "status", "--no-pager", WEB_UNIT], check=False)
        compose(checkout, ENV_FILE, "ps")
        subprocess.run(["/usr/local/sbin/capibloques-dev-firewall", "status"], check=True)
    elif args.command == "supervise":
        supervise(values)
    else:
        stop(values)


if __name__ == "__main__":
    require_dev_root()
    main()
