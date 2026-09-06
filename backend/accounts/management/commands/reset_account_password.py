from getpass import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from accounts.models import AccessEvent, User, access_lock, normalize_alias


class Command(BaseCommand):
    help = "Recuperación local de una cuenta existente: contraseña temporal y revocación de sesiones."

    def add_arguments(self, parser):
        parser.add_argument("alias")

    def handle(self, *args, **options):
        try:
            user = User.objects.get(username=normalize_alias(options["alias"]))
            password = getpass("Nueva contraseña temporal (no se muestra): ")
            if password != getpass("Repetir contraseña: "):
                raise CommandError("Las contraseñas no coinciden.")
            validate_password(password, user)
            with access_lock():
                user = User.objects.get(pk=user.pk)
                user.set_password(password)
                user.must_change_password = True
                user.save(update_fields=["password", "must_change_password"])
                AccessEvent.objects.create(user=user, action="local_password_reset")
        except User.DoesNotExist:
            raise CommandError("La cuenta no existe; no se creó ni cambió otra.") from None
        except (ValidationError, EOFError, KeyboardInterrupt) as error:
            raise CommandError(" ".join(error.messages) if isinstance(error, ValidationError) else "Recuperación cancelada.") from None
        self.stdout.write(self.style.SUCCESS("Contraseña restablecida. Sesiones revocadas; se exigirá cambiarla al ingresar."))
