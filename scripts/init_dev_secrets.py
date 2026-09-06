"""Genera secretos DEV sin mostrarlos ni sobrescribir una instalación existente."""
import argparse
import os
import secrets
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve()
    repo = Path(__file__).resolve().parents[1]
    if directory == repo or repo in directory.parents:
        parser.error("El directorio de secretos debe estar fuera del repositorio")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name == "posix":
        directory.chmod(0o700)
    created = 0
    for name in ("django_key", "db_admin_password", "db_app_password"):
        path = directory / name
        if path.is_symlink():
            parser.error("No se permiten enlaces como archivos de secretos")
        try:
            # Apertura exclusiva: dos inicializaciones no pueden rotar claves.
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o400)
        except FileExistsError:
            if not path.is_file() or len(path.read_text(encoding="utf-8").strip()) < 64:
                parser.error("Existe un secreto inválido; no se sobrescribió")
        else:
            with os.fdopen(fd, "w", encoding="utf-8") as target:
                target.write(secrets.token_hex(64) + "\n")
            created += 1
        # Compose monta archivos conservando permisos del host. Los procesos
        # 1000 y postgres necesitan leerlos; el directorio padre es privado 0700.
        if os.name == "posix":
            path.chmod(0o444)
    print(f"Secretos DEV preparados: {created} nuevos; {3 - created} conservados. Valores no mostrados.")


if __name__ == "__main__":
    main()
