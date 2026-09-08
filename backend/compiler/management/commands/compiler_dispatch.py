import json
import sys
from django.core.management.base import BaseCommand, CommandError
from compiler.services import dispatch


class Command(BaseCommand):
    help = "Protocolo privado del planificador local; nunca publicar como HTTP."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["register", "inspect", "claim", "heartbeat", "finish"])

    def handle(self, *args, **options):
        try:
            data = sys.stdin.buffer.read(8193)
            if len(data) > 8192:
                raise ValueError
            result = dispatch(options["action"], json.loads(data or b"{}"))
            self.stdout.write(json.dumps(result))
        except Exception:
            # No exception context/traceback containing credentials to the runner.
            raise CommandError("No se pudo completar la operación del compilador.") from None
