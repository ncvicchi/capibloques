from io import BytesIO

from django.http import JsonResponse

from .validation import MAX_FILE_BYTES


class ProjectUploadLimit:
    """Excepción acotada al límite JSON pequeño del resto de la aplicación."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/review/") and request.method in ("POST", "PATCH"):
            try:
                length = int(request.META.get("CONTENT_LENGTH", ""))
                if request.content_type != "application/json" or not 0 < length <= 16000:
                    raise ValueError
                data = request.read(16001)
                if len(data) != length:
                    raise ValueError
            except (ValueError, TypeError, OSError):
                response = JsonResponse({"error": "El mensaje excede el tamaño admitido.", "code": "upload_size"}, status=413)
                response["Cache-Control"] = "no-store"
                return response
            request._body = data
            request._stream = BytesIO(data)
        if request.path.startswith("/api/projects/") and request.method in ("POST", "PUT"):
            try:
                length = int(request.META.get("CONTENT_LENGTH", ""))
                if request.content_type != "application/json" or not 0 < length <= MAX_FILE_BYTES + 4096:
                    raise ValueError
                data = request.read(MAX_FILE_BYTES + 4097)
                if len(data) != length:
                    raise ValueError
            except (ValueError, TypeError, OSError):
                response = JsonResponse({"error": "Enviá JSON de hasta 2 MB con su tamaño declarado.", "code": "upload_size"}, status=413)
                response["Cache-Control"] = "no-store"
                return response
            request._body = data
            request._stream = BytesIO(data)
        return self.get_response(request)
