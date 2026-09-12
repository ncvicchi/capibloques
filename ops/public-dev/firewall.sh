#!/bin/sh
set -eu

CHAIN=CAPIBLOQUES_DEV_IN
ENV_FILE=${CAPIBLOQUES_PUBLIC_ENV_FILE:-/etc/capibloques/public-dev.env}
IPTABLES=${IPTABLES:-/usr/sbin/iptables}

if [ "$(id -u)" -ne 0 ]; then
  echo "El firewall requiere root" >&2
  exit 77
fi

read_setting() {
  awk -F= -v wanted="$1" '
    $1 == wanted {
      sub(/^[^=]*=/, "")
      print
      found++
    }
    END { if (found != 1) exit 1 }
  ' "$ENV_FILE"
}

load_settings() {
  [ -r "$ENV_FILE" ] || { echo "Falta $ENV_FILE" >&2; exit 78; }
  EDGE_IP=$(read_setting CAPIBLOQUES_EDGE_IP)
  BIND_IP=$(read_setting CAPIBLOQUES_PUBLIC_BIND_IP)
  PUBLIC_PORT=$(read_setting CAPIBLOQUES_PUBLIC_PORT)
  python3 - "$EDGE_IP" "$BIND_IP" "$PUBLIC_PORT" <<'PY'
import ipaddress
import sys

edge, bind, raw_port = sys.argv[1:]
for label, value in (("edge", edge), ("bind", bind)):
    address = ipaddress.ip_address(value)
    if address.version != 4 or address.is_unspecified or address.is_multicast:
        raise SystemExit(f"IP {label} inválida")
port = int(raw_port)
if not 1024 <= port <= 65535:
    raise SystemExit("Puerto público inválido")
PY
}

remove_jump() {
  while "$IPTABLES" -w 5 -C DOCKER-USER -j "$CHAIN" 2>/dev/null; do
    "$IPTABLES" -w 5 -D DOCKER-USER -j "$CHAIN"
  done
}

quiesce_editor() {
  # Selección acotada: nunca detener otros proyectos ni otros servicios.
  if command -v docker >/dev/null 2>&1; then
    containers=$(docker ps -q \
      --filter label=com.docker.compose.project=capibloques-dev \
      --filter label=com.docker.compose.service=editor)
    if [ -n "$containers" ]; then
      docker stop --time 15 $containers >/dev/null
    fi
  fi
}

apply_rules() {
  load_settings
  # Al reconstruir la cadena existe un instante sin reglas internas. El puerto
  # debe estar cerrado antes de vaciarla; web.service lo levantará después.
  quiesce_editor
  "$IPTABLES" -w 5 -n -L DOCKER-USER >/dev/null
  "$IPTABLES" -w 5 -N "$CHAIN" 2>/dev/null || true
  "$IPTABLES" -w 5 -F "$CHAIN"
  # Sólo afecta conexiones dirigidas originalmente al puerto publicado. RETURN
  # conserva la evaluación de todas las reglas ajenas de DOCKER-USER.
  "$IPTABLES" -w 5 -A "$CHAIN" -p tcp -s "$EDGE_IP" \
    -m conntrack --ctdir ORIGINAL --ctorigdst "$BIND_IP" --ctorigdstport "$PUBLIC_PORT" -j RETURN
  "$IPTABLES" -w 5 -A "$CHAIN" -p tcp \
    -m conntrack --ctdir ORIGINAL --ctorigdst "$BIND_IP" --ctorigdstport "$PUBLIC_PORT" -j DROP
  "$IPTABLES" -w 5 -A "$CHAIN" -j RETURN
  remove_jump
  "$IPTABLES" -w 5 -I DOCKER-USER 1 -j "$CHAIN"
}

remove_rules() {
  # Nunca retirar el DROP mientras el puerto correspondiente siga publicado.
  quiesce_editor
  if ! "$IPTABLES" -w 5 -n -L DOCKER-USER >/dev/null 2>&1; then
    return 0
  fi
  remove_jump
  if "$IPTABLES" -w 5 -n -L "$CHAIN" >/dev/null 2>&1; then
    "$IPTABLES" -w 5 -F "$CHAIN"
    "$IPTABLES" -w 5 -X "$CHAIN"
  fi
}

status_rules() {
  load_settings
  "$IPTABLES" -w 5 -C DOCKER-USER -j "$CHAIN"
  "$IPTABLES" -w 5 -C "$CHAIN" -p tcp -s "$EDGE_IP" \
    -m conntrack --ctdir ORIGINAL --ctorigdst "$BIND_IP" --ctorigdstport "$PUBLIC_PORT" -j RETURN
  "$IPTABLES" -w 5 -C "$CHAIN" -p tcp \
    -m conntrack --ctdir ORIGINAL --ctorigdst "$BIND_IP" --ctorigdstport "$PUBLIC_PORT" -j DROP
  "$IPTABLES" -w 5 -S "$CHAIN"
}

mkdir -p /run/lock
exec 9>/run/lock/capibloques-dev-firewall.lock
flock -x 9

case "${1:-}" in
  apply) apply_rules ;;
  remove) remove_rules ;;
  status) status_rules ;;
  *) echo "Uso: $0 {apply|remove|status}" >&2; exit 64 ;;
esac
