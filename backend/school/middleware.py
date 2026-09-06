from django.http import JsonResponse

MAX_UPLOAD = 2 * 1024 * 1024


class SchoolUploadLimit:
    """Límite total ANTES del parser multipart/CSRF, también para anónimos."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/api/management/school/" and request.method == "POST":
            try:
                length = int(request.META.get("CONTENT_LENGTH", ""))
                if not 0 < length <= MAX_UPLOAD + 16 * 1024:
                    raise ValueError
            except (ValueError, TypeError):
                response = JsonResponse({"error": "La carga es demasiado grande o no indica su tamaño. El logo debe pesar hasta 2 MiB.", "code": "upload_size"}, status=413)
                response["Cache-Control"] = "no-store"
                return response
        return self.get_response(request)
