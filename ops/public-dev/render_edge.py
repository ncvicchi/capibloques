"""Renderiza un vhost DEV sin instalarlo ni leer credenciales."""
import argparse
import ipaddress
from pathlib import Path, PurePosixPath
import re


FQDN = re.compile(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
TOKEN = re.compile(r"\$\{([A-Z0-9_]+)\}")
PRIVATE_NETWORKS = tuple(
    ipaddress.ip_network(value) for value in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")
)


def absolute_path(value):
    # Son rutas de la VM Linux aunque la plantilla se prepare desde Windows.
    path = PurePosixPath(value)
    if not path.is_absolute() or not re.fullmatch(r"/[A-Za-z0-9._/-]+", value):
        raise argparse.ArgumentTypeError("se requiere una ruta Linux absoluta y segura")
    return str(path)


def fqdn(value):
    value = value.strip().lower().rstrip(".")
    if not FQDN.fullmatch(value):
        raise argparse.ArgumentTypeError("FQDN inválido")
    return value


def upstream(value):
    try:
        host, raw_port = value.rsplit(":", 1)
        address = ipaddress.ip_address(host)
        port = int(raw_port)
    except (ValueError, TypeError):
        raise argparse.ArgumentTypeError("upstream debe ser IPv4:puerto") from None
    if (address.version != 4 or not any(address in network for network in PRIVATE_NETWORKS)
            or not 1 <= port <= 65535):
        raise argparse.ArgumentTypeError("upstream debe ser una IPv4 LAN privada y un puerto válido")
    return f"{address}:{port}"


def listen_port(value):
    try:
        number = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("puerto de escucha inválido") from None
    if not 1 <= number <= 65535:
        raise argparse.ArgumentTypeError("puerto de escucha inválido")
    return number


def basic_auth(path):
    if path is None:
        return "    # Basic Auth deshabilitado; la aplicación conserva su propio login."
    return (
        '    auth_basic "CapiBloques DEV";\n'
        f"    auth_basic_user_file {path};"
    )


def render(template, values):
    expected = set(TOKEN.findall(template))
    if expected != set(values):
        raise SystemExit(f"Contrato de plantilla inesperado: {sorted(expected)}")
    for name, value in values.items():
        template = template.replace("${" + name + "}", value)
    if TOKEN.search(template):
        raise SystemExit("Quedaron variables sin resolver")
    return template


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("http", "https"))
    parser.add_argument("--fqdn", required=True, type=fqdn)
    parser.add_argument("--acme-root", required=True, type=absolute_path)
    parser.add_argument("--http-port", default=80, type=listen_port)
    parser.add_argument("--https-port", default=443, type=listen_port)
    parser.add_argument("--upstream", type=upstream)
    parser.add_argument("--certificate", type=absolute_path)
    parser.add_argument("--certificate-key", type=absolute_path)
    parser.add_argument(
        "--tls-options",
        default="/etc/letsencrypt/options-ssl-nginx.conf",
        type=absolute_path,
    )
    parser.add_argument(
        "--dhparam",
        default="/etc/letsencrypt/ssl-dhparams.pem",
        type=absolute_path,
    )
    parser.add_argument(
        "--basic-auth-file",
        type=absolute_path,
        help="htpasswd existente en el edge; el archivo y sus hashes quedan fuera de Git",
    )
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    directory = Path(__file__).resolve().parent
    http = (directory / "edge-http.conf.template").read_text(encoding="utf-8")
    values = {
        "CAPIBLOQUES_DEV_FQDN": args.fqdn,
        "CAPIBLOQUES_DEV_ACME_ROOT": args.acme_root,
        "CAPIBLOQUES_DEV_HTTP_PORT": str(args.http_port),
    }
    result = render(http, values)
    if args.stage == "https":
        missing = [name for name in ("upstream", "certificate", "certificate_key") if getattr(args, name) is None]
        if missing:
            parser.error("HTTPS requiere --upstream, --certificate y --certificate-key")
        https = (directory / "edge-https.conf.template").read_text(encoding="utf-8")
        result += "\n" + render(https, {
            "CAPIBLOQUES_DEV_FQDN": args.fqdn,
            "CAPIBLOQUES_DEV_HTTPS_PORT": str(args.https_port),
            "CAPIBLOQUES_DEV_UPSTREAM": args.upstream,
            "CAPIBLOQUES_DEV_CERTIFICATE": args.certificate,
            "CAPIBLOQUES_DEV_CERTIFICATE_KEY": args.certificate_key,
            "CAPIBLOQUES_DEV_TLS_OPTIONS": args.tls_options,
            "CAPIBLOQUES_DEV_DHPARAM": args.dhparam,
            "CAPIBLOQUES_DEV_BASIC_AUTH": basic_auth(args.basic_auth_file),
        })

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_name(args.output.name + ".tmp")
    temporary.write_text(result, encoding="utf-8")
    temporary.replace(args.output)


if __name__ == "__main__":
    main()
