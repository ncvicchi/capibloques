from io import BytesIO
import warnings

from django.core.exceptions import ValidationError
from PIL import Image, ImageOps, UnidentifiedImageError

from .middleware import MAX_UPLOAD

FORMATS = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}


def normalize_logo(upload):
    if not 0 < upload.size <= MAX_UPLOAD or upload.content_type not in FORMATS:
        raise ValidationError("Elegí PNG, JPEG o WebP de hasta 2 MiB. SVG, GIF y archivos animados no se admiten.")
    raw = upload.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise ValidationError("El logo supera los 2 MiB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw), formats=list(FORMATS.values())) as source:
                if source.format != FORMATS[upload.content_type]:
                    raise ValidationError("El contenido de la imagen no coincide con su formato declarado.")
                width, height = source.size
                if max(width, height) > 2048 or width * height > 4_000_000:
                    raise ValidationError("El logo admite hasta 2048 píxeles por lado y 4 millones de píxeles en total.")
                if getattr(source, "n_frames", 1) != 1:
                    raise ValidationError("Usá una imagen fija, sin animación.")
                source.verify()
            with Image.open(BytesIO(raw), formats=list(FORMATS.values())) as source:
                source.load()
                oriented = ImageOps.exif_transpose(source)
                rgba = oriented.convert("RGBA")
                rgba.thumbnail((512, 512), Image.Resampling.LANCZOS)
                # Un buffer de píxeles nuevo no hereda EXIF, ICC, texto ni archivos anexos.
                clean = Image.frombytes("RGBA", rgba.size, rgba.tobytes())
                result = BytesIO()
                clean.save(result, format="PNG")
                encoded = result.getvalue()
                if len(encoded) > 1024 * 1024:
                    raise ValidationError("La imagen optimizada es demasiado compleja. Probá un logo más pequeño.")
                return encoded
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ValidationError("No pudimos leer esa imagen. Elegí un PNG, JPEG o WebP válido y sin daños.") from None
