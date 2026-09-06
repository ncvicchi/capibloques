from getpass import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from accounts.models import AccessEvent, User, access_lock, normalize_alias


class Command(BaseCommand):
    help = "Crear el primer administrador localmente; no acepta contraseñas como argumentos."

    def handle(self, *args, **options):
        if User.objects.filter(is_administrator=True).exists():
            raise CommandError("Ya existe un administrador. Este comando no crea ni reemplaza otro.")
        try:
            alias = normalize_alias(input("Alias del administrador: "))
            name = input("Nombre visible: ").strip()
            user = User(username=alias, display_name=name, is_administrator=True, is_student=False, must_change_password=False)
            user.full_clean(exclude=["password"])
            password = getpass("Contraseña (no se muestra): ")
            if password != getpass("Repetir contraseña: "):
                raise CommandError("Las contraseñas no coinciden.")
            validate_password(password, user)
            with access_lock():
                if User.objects.filter(is_administrator=True).exists():
                    raise CommandError("Otro proceso ya creó el administrador.")
                user.set_password(password)
                user.save()
                AccessEvent.objects.create(user=user, action="bootstrap_admin")
        except (ValidationError, EOFError, KeyboardInterrupt) as error:
            raise CommandError(" ".join(error.messages) if isinstance(error, ValidationError) else "Creación cancelada.") from None
        self.stdout.write(self.style.SUCCESS("Administrador creado. Ya podés ingresar en /cuenta/."))
