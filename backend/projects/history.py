"""Snapshots anteriores inmutables, bajo el access_lock de la operación."""
from datetime import timedelta
from django.db.models import Sum
from django.utils import timezone
from .models import ProjectRevision
from .validation import require

HISTORY_PREVIOUS = 19  # Más la actual: hasta 20 puntos no referenciados.
MAX_HISTORY_BYTES = 50_000_000
CHECKPOINT_INTERVAL = timedelta(minutes=5)


def archive_current(project, force=False):
    if not project.history_checkpoint and not force:
        return
    ProjectRevision.objects.get_or_create(project=project, revision=project.revision, defaults={
        "document": project.document, "size_bytes": project.size_bytes, "title": project.title,
        "kind": project.history_kind, "created_at": project.updated_at,
        "course_id": project.course_id,
    })
    # Política visible: conservar la actual y las 19 anteriores no fijadas más
    # recientes. Las referenciadas no participan de esta poda; sí de la cuota.
    stale = list(project.history.filter(pinned=False).order_by("-revision").values_list("pk", flat=True)[HISTORY_PREVIOUS:])
    if stale:
        project.history.filter(pk__in=stale, pinned=False).delete()
    used = ProjectRevision.objects.filter(project__owner_id=project.owner_id).aggregate(size=Sum("size_bytes"))["size"] or 0
    require(used <= MAX_HISTORY_BYTES, "Alcanzaste los 50 MB de historial. No se guardó ni se eliminó nada. Exportá y revisá versiones anteriores para liberar espacio.")


def mark_checkpoint(project, mode):
    now = timezone.now()
    project.history_checkpoint = mode != "automatic" or now - project.last_checkpoint_at >= CHECKPOINT_INTERVAL
    project.history_kind = mode
    if project.history_checkpoint:
        project.last_checkpoint_at = now


def revision_metadata(project, row=None):
    return {"revision": row.revision if row else project.revision,
            "title": row.title if row else project.title,
            "createdAt": (row.created_at if row else project.updated_at).isoformat(),
            "kind": row.kind if row else project.history_kind,
            "current": row is None, "pinned": row.pinned if row else project.history.filter(revision=project.revision, pinned=True).exists(),
            "bytes": row.size_bytes if row else project.size_bytes}
