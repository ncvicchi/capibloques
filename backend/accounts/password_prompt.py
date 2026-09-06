from getpass import GetPassWarning, getpass
import warnings

from django.contrib.auth.password_validation import password_validators_help_texts, validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import CommandError


def prompt_password(command, user, *, label="Contraseña (no se muestra): "):
    """Reintenta sin perder identidad, persistir nada ni mostrar contraseñas."""
    command.stdout.write("Elegí una contraseña. Podés cancelar con Ctrl+C sin guardar cambios.")
    for help_text in password_validators_help_texts():
        command.stdout.write(f"- {help_text}")
    command.stdout.write("- Máximo 256 caracteres, igual que en el ingreso web.")

    # Si falta un TTY, getpass no debe recurrir a leer una contraseña con eco.
    with warnings.catch_warnings():
        warnings.simplefilter("error", GetPassWarning)
        try:
            while True:
                password = getpass(label)
                try:
                    if len(password) > 256:
                        raise ValidationError("La contraseña puede tener hasta 256 caracteres.")
                    validate_password(password, user)
                except ValidationError as error:
                    command.stderr.write("Contraseña no aceptada:")
                    for message in error.messages:
                        command.stderr.write(f"- {message}")
                    command.stderr.write("Probá otra contraseña; se conservan el alias y el nombre. Ctrl+C cancela.")
                    continue
                if password != getpass("Repetir contraseña: "):
                    command.stderr.write("Las contraseñas no coinciden. Volvé a ingresarlas. Ctrl+C cancela.")
                    continue
                return password
        except GetPassWarning:
            raise CommandError("No se puede ocultar la contraseña. Abrí el asistente en una terminal interactiva.") from None
