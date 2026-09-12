#!/bin/sh
set -eu

# `allow` no acepta una variable en tiempo de petición. Validar antes de que el
# entrypoint oficial haga envsubst impide convertir una variable privada en
# directivas Nginx arbitrarias.
if ! printf '%s\n' "${CAPIBLOQUES_EDGE_IP:-}" | awk -F. '
  NF != 4 { exit 1 }
  {
    for (i = 1; i <= 4; i++) {
      if ($i !~ /^[0-9]+$/ || $i < 0 || $i > 255) exit 1
    }
  }
'; then
  echo "CAPIBLOQUES_EDGE_IP debe ser una IPv4 exacta" >&2
  exit 64
fi

exec /docker-entrypoint.sh "$@"
