"""Instala configuración privada y firewall de DEV; nunca toca el edge."""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
from datetime import datetime, timezone


ENV_DIR = Path("/etc/capibloques")
ENV_FILE = ENV_DIR / "public-dev.env"
BACKUP_ROOT = Path("/var/backups/capibloques-public-dev")
FIREWALL_TARGET = Path("/usr/local/sbin/capibloques-dev-firewall")
RUNTIME_TARGET = Path("/usr/local/sbin/capibloques-dev-runtime")
UNIT_TARGET = Path("/etc/systemd/system/capibloques-dev-firewall.service")
WEB_UNIT_TARGET = Path("/etc/systemd/system/capibloques-dev-web.service")
TARGETS = (ENV_FILE, FIREWALL_TARGET, RUNTIME_TARGET, UNIT_TARGET, WEB_UNIT_TARGET)
FQDN = re.compile(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
PRIVATE_NETWORKS = tuple(
    ipaddress.ip_network(value) for value in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)
API_BOUNDARY_KEYS = frozenset({
    "CAPIBLOQUES_PROXY_SUBNET",
    "CAPIBLOQUES_WEB_PROXY_IP",
    "CAPIBLOQUES_API_PROXY_IP",
    "CAPIBLOQUES_ALLOWED_HOSTS",
    "CAPIBLOQUES_CSRF_TRUSTED_ORIGINS",
    "CAPIBLOQUES_TRUSTED_PROXY_IPS",
    "CAPIBLOQUES_SECURE_COOKIES",
})


def require_dev_root():
    if os.getuid() != 0 or socket.gethostname() != "capi-dev":
        raise SystemExit("Sólo root en capi-dev puede instalar esta entrada DEV")


def exact_ipv4(value, *, private=False, loopback=False):
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        raise argparse.ArgumentTypeError("se requiere una IPv4 exacta") from None
    if address.version != 4 or address.is_unspecified or address.is_multicast:
        raise argparse.ArgumentTypeError("IPv4 no utilizable")
    if private and not any(address in network for network in PRIVATE_NETWORKS):
        raise argparse.ArgumentTypeError("se requiere una IPv4 LAN privada")
    if loopback and not address.is_loopback:
        raise argparse.ArgumentTypeError("se requiere una IPv4 loopback")
    return address


def port(value):
    try:
        number = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("puerto inválido") from None
    if not 1024 <= number <= 65535:
        raise argparse.ArgumentTypeError("el puerto debe estar entre 1024 y 65535")
    return number


def fqdn(value):
    value = value.strip().lower().rstrip(".")
    if not FQDN.fullmatch(value):
        raise argparse.ArgumentTypeError("FQDN inválido")
    return value


def private_network(value):
    try:
        network = ipaddress.ip_network(value, strict=True)
    except ValueError:
        raise argparse.ArgumentTypeError("se requiere una subred IPv4 canónica") from None
    if network.version != 4 or not any(network.subnet_of(parent) for parent in PRIVATE_NETWORKS):
        raise argparse.ArgumentTypeError("la subred interna debe pertenecer a un rango IPv4 privado")
    return network


def command_state(arguments):
    return subprocess.run(arguments, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def validate_docker_subnet(candidate):
    identifiers = subprocess.check_output(["docker", "network", "ls", "-q"], text=True).split()
    if not identifiers:
        return False
    public_network_exists = False
    lines = subprocess.check_output(
        ["docker", "network", "inspect", "--format", "{{.Name}} {{json .IPAM.Config}}", *identifiers],
        text=True,
    ).splitlines()
    for line in lines:
        name, raw = line.split(" ", 1)
        for entry in json.loads(raw) or []:
            subnet = entry.get("Subnet")
            if not subnet:
                continue
            existing = ipaddress.ip_network(subnet, strict=False)
            if name == "capibloques-dev_public_api" and candidate.version == existing.version:
                if existing != candidate:
                    raise SystemExit(
                        "La red Docker public_api existente usa otra subred; no se cambia en caliente"
                    )
                public_network_exists = True
                continue
            if candidate.version != existing.version or not candidate.overlaps(existing):
                continue
            raise SystemExit(f"La subred interna colisiona con la red Docker {name}")
    return public_network_exists


def validate_host_network(candidate, public_bind, edge, public_network_exists):
    addresses = json.loads(subprocess.check_output(["ip", "-j", "address", "show"], text=True))
    local = {
        ipaddress.ip_address(item["local"])
        for interface in addresses
        for item in interface.get("addr_info", [])
        if item.get("family") == "inet" and item.get("local")
    }
    if public_bind not in local:
        raise SystemExit("La IP pública interna no pertenece a capi-dev")

    routes = json.loads(subprocess.check_output(["ip", "-j", "route", "show"], text=True))
    for route in routes:
        destination = route.get("dst")
        if not destination or destination == "default":
            continue
        try:
            existing = ipaddress.ip_network(destination, strict=False)
        except ValueError:
            continue
        if candidate.version != existing.version or not candidate.overlaps(existing):
            continue
        if public_network_exists and candidate == existing:
            continue
        raise SystemExit(f"La subred interna colisiona con la ruta {existing}")

    path = json.loads(subprocess.check_output(["ip", "-j", "route", "get", str(edge)], text=True))
    if len(path) != 1:
        raise SystemExit("No se pudo determinar una ruta única hacia el edge")
    route = path[0]
    if route.get("gateway") or route.get("dev") in (None, "lo"):
        raise SystemExit("El edge no está conectado directamente por la LAN")
    if route.get("prefsrc") != str(public_bind):
        raise SystemExit("La ruta al edge no usa la IP LAN elegida para capi-dev")


def atomic_write(path, content, mode):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(content, encoding="utf-8")
    os.chmod(temporary, mode)
    os.chown(temporary, 0, 0)
    os.replace(temporary, path)


def atomic_copy(source, destination, mode):
    atomic_write(destination, source.read_text(encoding="utf-8"), mode)


def snapshot():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    os.chmod(BACKUP_ROOT, 0o700)
    os.chown(BACKUP_ROOT, 0, 0)
    destination = BACKUP_ROOT / f"{stamp}-{os.getpid()}"
    destination.mkdir(parents=True, mode=0o700)
    manifest = {
        "units": {
            unit.name: {
                "enabled": command_state(["systemctl", "is-enabled", unit.name]),
                "active": command_state(["systemctl", "is-active", unit.name]),
            }
            for unit in (UNIT_TARGET, WEB_UNIT_TARGET)
        },
        "files": {},
    }
    for target in TARGETS:
        if target.is_file():
            saved = target.name
            shutil.copy2(target, destination / saved)
            manifest["files"][str(target)] = saved
        else:
            manifest["files"][str(target)] = None
    atomic_write(destination / "manifest.json", json.dumps(manifest, indent=2) + "\n", 0o600)
    return destination


def restore(backup):
    backup = backup.resolve()
    root = BACKUP_ROOT.resolve()
    if backup.parent != root or not backup.is_dir():
        raise SystemExit("El respaldo no pertenece a CapiBloques")
    manifest = json.loads((backup / "manifest.json").read_text(encoding="utf-8"))
    subprocess.run(["systemctl", "stop", WEB_UNIT_TARGET.name], check=False)
    subprocess.run(["systemctl", "stop", UNIT_TARGET.name], check=False)
    for target in TARGETS:
        saved = manifest["files"].get(str(target))
        if saved is None:
            target.unlink(missing_ok=True)
        else:
            mode = 0o600 if target == ENV_FILE else (0o755 if target in (FIREWALL_TARGET, RUNTIME_TARGET) else 0o644)
            atomic_copy(backup / saved, target, mode)
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    for unit in (UNIT_TARGET, WEB_UNIT_TARGET):
        state = manifest["units"][unit.name]
        if state["enabled"]:
            subprocess.run(["systemctl", "enable", unit.name], check=True)
        else:
            subprocess.run(["systemctl", "disable", unit.name], check=False)
    # Dependencias primero; nunca levantar web sin la cadena de firewall.
    for unit in (UNIT_TARGET, WEB_UNIT_TARGET):
        if manifest["units"][unit.name]["active"]:
            subprocess.run(["systemctl", "start", unit.name], check=True)
    print(f"Configuración restaurada desde {backup}")


def install(args):
    checkout = Path(__file__).resolve().parents[2]
    network = args.proxy_subnet
    if network.prefixlen > 29:
        raise SystemExit("La red interna debe ser IPv4 y contener al menos seis hosts")
    web_ip = args.web_proxy_ip
    api_ip = args.api_proxy_ip
    usable = lambda address: network.network_address < address < network.broadcast_address
    if not usable(web_ip) or not usable(api_ip) or web_ip == api_ip:
        raise SystemExit("Las IP internas deben ser hosts distintos de la subred declarada")
    if network.network_address + 1 in (web_ip, api_ip):
        raise SystemExit("La primera IP utilizable queda reservada para el gateway Docker")
    if args.edge_ip == args.public_bind_ip:
        raise SystemExit("El edge y capi-dev deben ser hosts distintos")
    public_network_exists = validate_docker_subnet(network)
    validate_host_network(network, args.public_bind_ip, args.edge_ip, public_network_exists)
    if subprocess.check_output(["git", "-C", checkout, "status", "--porcelain"], text=True).strip():
        raise SystemExit("El checkout debe estar limpio antes de instalar el runtime versionado")
    revision = subprocess.check_output(["git", "-C", checkout, "rev-parse", "HEAD"], text=True).strip()
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise SystemExit("No se pudo identificar el commit del checkout")

    # En una reinstalación conservar la imagen saludable ya desplegada. El
    # comando deploy cambia la etiqueta sólo después de construir y probar.
    previous = {}
    if ENV_FILE.is_file():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if "=" in raw:
                key, value = raw.split("=", 1)
                previous[key] = value
    image_tag = previous.get("CAPIBLOQUES_WEB_IMAGE_TAG", revision[:12])
    image_revision = previous.get("CAPIBLOQUES_BUILD_REVISION", revision)
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}", image_tag):
        raise SystemExit("La etiqueta desplegada anterior es inválida")
    if not re.fullmatch(r"[0-9a-f]{40}", image_revision):
        raise SystemExit("La revisión desplegada anterior es inválida")

    values = {
        "CAPIBLOQUES_CHECKOUT": str(checkout),
        "CAPIBLOQUES_EDGE_IP": str(args.edge_ip),
        "CAPIBLOQUES_PUBLIC_BIND_IP": str(args.public_bind_ip),
        "CAPIBLOQUES_PUBLIC_PORT": str(args.public_port),
        "CAPIBLOQUES_LOCAL_BIND_IP": str(args.local_bind_ip),
        "CAPIBLOQUES_LOCAL_PORT": str(args.local_port),
        "CAPIBLOQUES_PROXY_SUBNET": str(network),
        "CAPIBLOQUES_WEB_PROXY_IP": str(web_ip),
        "CAPIBLOQUES_API_PROXY_IP": str(api_ip),
        "CAPIBLOQUES_ALLOWED_HOSTS": args.fqdn,
        "CAPIBLOQUES_CSRF_TRUSTED_ORIGINS": f"https://{args.fqdn}",
        "CAPIBLOQUES_TRUSTED_PROXY_IPS": f"{web_ip},{args.edge_ip}",
        "CAPIBLOQUES_SECURE_COOKIES": "true",
        "CAPIBLOQUES_BUILD_REVISION": image_revision,
        "CAPIBLOQUES_WEB_IMAGE_TAG": image_tag,
    }
    boundary_changed = (
        not previous
        or previous.get("CAPIBLOQUES_API_RECREATE_REQUIRED") != "false"
        or any(previous.get(key) != values[key] for key in API_BOUNDARY_KEYS)
    )
    values["CAPIBLOQUES_API_RECREATE_REQUIRED"] = "true" if boundary_changed else "false"
    if any("\n" in value or "\r" in value for value in values.values()):
        raise SystemExit("Configuración inválida")
    environment = "".join(f"{key}={value}\n" for key, value in values.items())

    backup = snapshot()
    source = checkout / "ops/public-dev"
    try:
        # Cerrar el listener antes de cambiar o retirar su firewall.
        subprocess.run(["systemctl", "stop", WEB_UNIT_TARGET.name], check=False)
        subprocess.run(["systemctl", "stop", UNIT_TARGET.name], check=False)
        atomic_write(ENV_FILE, environment, 0o600)
        atomic_copy(source / "firewall.sh", FIREWALL_TARGET, 0o755)
        atomic_copy(source / "runtime.py", RUNTIME_TARGET, 0o755)
        atomic_copy(source / "capibloques-dev-firewall.service", UNIT_TARGET, 0o644)
        atomic_copy(source / "capibloques-dev-web.service", WEB_UNIT_TARGET, 0o644)
        subprocess.run(["systemctl", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "enable", "--now", UNIT_TARGET.name], check=True)
        previous_web = backup / "manifest.json"
        prior = json.loads(previous_web.read_text(encoding="utf-8"))["units"][WEB_UNIT_TARGET.name]
        if boundary_changed:
            # La API en ejecución todavía conserva el entorno anterior. Dejar
            # el puerto cerrado hasta que runtime haga un recreate explícito.
            subprocess.run(["systemctl", "disable", WEB_UNIT_TARGET.name], check=False)
        else:
            if prior["enabled"]:
                subprocess.run(["systemctl", "enable", WEB_UNIT_TARGET.name], check=True)
            if prior["active"]:
                subprocess.run(["systemctl", "start", WEB_UNIT_TARGET.name], check=True)
    except Exception:
        restore(backup)
        raise
    print(f"Configuración instalada. Respaldo reversible: {backup}")
    if boundary_changed:
        print("La entrada queda cerrada hasta ejecutar capibloques-dev-runtime deploy --with-api.")
    else:
        print("La frontera API no cambió; se preservó el estado previo del servicio web.")


def parser():
    result = argparse.ArgumentParser()
    commands = result.add_subparsers(dest="command", required=True)
    apply = commands.add_parser("install")
    apply.add_argument("--edge-ip", required=True, type=lambda value: exact_ipv4(value, private=True))
    apply.add_argument("--public-bind-ip", required=True, type=lambda value: exact_ipv4(value, private=True))
    apply.add_argument("--public-port", default=3080, type=port)
    apply.add_argument("--local-bind-ip", default=ipaddress.ip_address("127.0.0.1"), type=lambda value: exact_ipv4(value, loopback=True))
    apply.add_argument("--local-port", default=3000, type=port)
    apply.add_argument("--proxy-subnet", default=ipaddress.ip_network("172.30.13.0/29"), type=private_network)
    apply.add_argument("--web-proxy-ip", default=ipaddress.ip_address("172.30.13.2"), type=exact_ipv4)
    apply.add_argument("--api-proxy-ip", default=ipaddress.ip_address("172.30.13.3"), type=exact_ipv4)
    apply.add_argument("--fqdn", required=True, type=fqdn)
    recover = commands.add_parser("restore")
    recover.add_argument("backup", type=Path)
    return result


if __name__ == "__main__":
    require_dev_root()
    arguments = parser().parse_args()
    if arguments.command == "install":
        install(arguments)
    else:
        restore(arguments.backup)
