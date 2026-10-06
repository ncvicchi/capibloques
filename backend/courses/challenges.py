"""Course-scoped challenges and minimal, explicitly self-assessed progress.

Published documents are immutable. The same fresh permission lock as projects
protects every operation. No new cascading relationships or child telemetry.
"""
import copy
import json
import uuid
import math
import re

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils import timezone
from accounts.models import User
from accounts.management_api import fail
from projects.views import endpoint
from projects.validation import document, require, encoded, bounded_json, BLOCKS
from .models import Course, CourseEvent, Membership
from .views import belonging


def payload(request, limit=260000):
    require(request.content_type == "application/json" and int(request.META.get("CONTENT_LENGTH") or 0) <= limit)
    require(len(request.body) <= limit)
    try:
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError()
                result[key] = value
            return result
        result = json.loads(request.body, object_pairs_hook=unique, parse_constant=lambda value: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError):
        raise ValidationError("El JSON del desafío no es válido.") from None
    require(isinstance(result, dict))
    bounded_json(result, 128, 35000)
    return result


def validate_challenge(value):
    require(isinstance(value, dict) and len(encoded(value)) <= 250000)
    require(set(value) == {"format", "schemaVersion", "id", "version", "title", "prompt", "stage", "concepts", "mode", "initial", "palette", "hints", "explanation", "variants", "expectations"})
    require(value["format"] == "CapiChallenge" and value["schemaVersion"] == 1)
    require(isinstance(value["id"], str) and bool(re.fullmatch(r"[-a-zA-Z0-9_]{1,100}", value["id"])))
    require(type(value["version"]) is int and 1 <= value["version"] <= 10000)
    require(type(value["stage"]) is int and 1 <= value["stage"] <= 14)
    for key, maximum in (("title", 100), ("prompt", 2000), ("explanation", 2000)):
        require(isinstance(value[key], str) and len(value[key]) <= maximum and (bool(value[key].strip()) or key == "explanation"))
    require(value["mode"] in ("empty", "partial", "broken", "refactor", "creative"))
    for key, count, length in (("palette", 180, 80), ("concepts", 10, 80), ("hints", 6, 500)):
        require(isinstance(value[key], list) and len(value[key]) <= count and all(isinstance(item, str) and 0 < len(item) <= length for item in value[key]))
    require(all(block in BLOCKS for block in value["palette"]))
    document(value["initial"])
    require(isinstance(value["variants"], list) and 1 <= len(value["variants"]) <= 8)
    devices = {item["id"]: item for item in value["initial"]["scene"]["devices"]}
    for variant in value["variants"]:
        require(isinstance(variant, dict) and {"label", "seed", "inputs", "goals"} <= set(variant) <= {"label", "seed", "inputs", "goals", "reserved"})
        require(type(variant.get("reserved", False)) is bool)
        require(isinstance(variant["label"], str) and len(variant["label"]) <= 80 and type(variant["seed"]) is int and 0 <= variant["seed"] <= 4294967295)
        require(isinstance(variant["inputs"], list) and len(variant["inputs"]) <= 16)
        for item in variant["inputs"]:
            require(isinstance(item, dict) and set(item) == {"deviceId", "values"} and isinstance(item["deviceId"], str) and item["deviceId"] in devices)
            require(devices[item["deviceId"]]["kind"] in ("button", "infraredBarrier", "lightSensor", "potentiometer"))
            require(isinstance(item["values"], list) and 1 <= len(item["values"]) <= 16 and all(type(v) in (bool, int) and (type(v) is bool or 0 <= v <= 4095) for v in item["values"]))
            boolean = devices[item["deviceId"]]["kind"] in ("button", "infraredBarrier")
            require(all(type(v) is (bool if boolean else int) for v in item["values"]))
        require(isinstance(variant["goals"], list) and (bool(variant["goals"]) or value["mode"] == "creative") and len(variant["goals"]) <= 16)
        for goal in variant["goals"]:
            require(isinstance(goal, dict) and set(goal) == {"label", "atMs", "value", "operator", "expected"})
            require(isinstance(goal["label"], str) and 0 < len(goal["label"]) <= 200 and type(goal["atMs"]) is int and 0 <= goal["atMs"] <= 120000)
            require(goal["operator"] in ("EQ", "NEQ", "LT", "LTE", "GT", "GTE", "CONTAINS") and type(goal["expected"]) in (str, int, float, bool) and isinstance(goal["value"], dict))
            require(type(goal["expected"]) not in (int, float) or math.isfinite(goal["expected"]))
            require(type(goal["expected"]) is not str or len(goal["expected"]) <= 2000)
            if goal["operator"] == "CONTAINS":
                require(type(goal["expected"]) is str)
            elif goal["operator"] not in ("EQ", "NEQ"):
                require(type(goal["expected"]) in (int, float))
            observation = goal["value"]
            require(observation.get("kind") in ("consoleText", "displayText", "actionCount", "number", "text", "boolean", "variable", "counterValue", "timerElapsed", "timerRemaining", "componentValue", "sensorValue", "ottoDistance", "buttonValue", "barrierValue", "displayButtonValue", "messageValue", "wifiValue", "join", "math"))
            if "deviceId" in observation:
                require(isinstance(observation["deviceId"], str) and observation["deviceId"] in devices)
            if observation["kind"] == "displayText":
                require(devices[observation["deviceId"]]["kind"] == "display" and isinstance(observation.get("areaId"), str))
    require(any(not variant.get("reserved", False) for variant in value["variants"]), "Debe haber al menos un caso visible para el alumno.")
    require(isinstance(value["expectations"], list) and len(value["expectations"]) <= 12)
    for item in value["expectations"]:
        require(isinstance(item, dict) and set(item) == {"operation", "minimum", "mandatory", "explanation"})
        require(isinstance(item["operation"], str) and type(item["minimum"]) is int and 1 <= item["minimum"] <= 100 and type(item["mandatory"]) is bool and isinstance(item["explanation"], str) and 0 < len(item["explanation"]) <= 500)
        require(not item["mandatory"] or item["explanation"] in value["prompt"], "La condición obligatoria debe figurar en la consigna.")
    return copy.deepcopy(value)


def course_for(actor, course_id, teacher=False):
    course = Course.objects.get(pk=course_id, is_archived=False, pk__in=belonging(actor).values('course_id'))
    if teacher and not (actor.is_teacher and Membership.objects.filter(course=course, user=actor, role="docente").exists()):
        raise Course.DoesNotExist
    return course


@endpoint(["GET"])
def catalog(request, actor):
    courses = []
    for course in Course.objects.filter(pk__in=belonging(actor).values('course_id'), is_archived=False).order_by("name"):
        teacher = actor.is_teacher and course.memberships.filter(user=actor, role="docente").exists()
        items = []
        for key, record in course.challenge_library.items():
            if teacher:
                items.append({"id": key, **record})
            elif record.get("assigned") and not record.get("archived"):
                version = record["assigned"]
                challenge = copy.deepcopy(record["versions"][str(version)])
                reserved = sum(bool(variant.get("reserved")) for variant in challenge["variants"])
                challenge["variants"] = [variant for variant in challenge["variants"] if not variant.get("reserved")]
                items.append({"id": key, "challenge": challenge, "reservedCaseCount": reserved})
        courses.append({"id": str(course.pk), "name": course.name, "teacher": teacher, "version": str(course.version), "items": items})
    return JsonResponse({"courses": courses, "progress": actor.challenge_progress})


@endpoint(["POST"])
def edit(request, actor, course_id):
    course = course_for(actor, course_id, True)
    data = payload(request)
    require(set(data) == {"version", "action", "challenge"})
    if data["version"] != str(course.version):
        return fail("El curso cambió. Actualizá antes de guardar; tu borrador sigue abierto.", "conflict", 409)
    action = data["action"]
    require(action in ("save", "publish", "assign", "archive"))
    challenge = validate_challenge(data["challenge"])
    key = challenge["id"]
    try:
        require(str(uuid.UUID(key)) == key, "Los desafíos docentes deben tener una identidad propia.")
    except (ValueError, TypeError):
        raise ValidationError("La identidad del desafío docente no es válida.") from None
    library = copy.deepcopy(course.challenge_library)
    require(key in library or len(library) < 30, "El curso admite hasta 30 desafíos.")
    record = library.setdefault(key, {"draft": None, "versions": {}, "assigned": None, "archived": False})
    if action == "save":
        record["draft"] = challenge
    elif action == "publish":
        require(record["draft"] == challenge, "Guardá el borrador antes de publicarlo.")
        require(str(challenge["version"]) not in record["versions"], "Esa versión ya está publicada: creá una nueva.")
        require(len(record["versions"]) < 10, "Se admiten hasta 10 versiones por desafío.")
        record["versions"][str(challenge["version"])] = challenge
    elif action == "assign":
        require(record["versions"].get(str(challenge["version"])) == challenge, "Sólo se asignan versiones publicadas.")
        record["assigned"] = challenge["version"]
        record["archived"] = False
    else:
        record["archived"] = True
    require(len(encoded(library)) <= 2000000, "La biblioteca del curso supera 2 MB.")
    course.challenge_library = library
    course.version = uuid.uuid4()
    course.save(update_fields=["challenge_library", "version", "updated_at"])
    CourseEvent.objects.create(actor=actor, actor_id_snapshot=actor.pk, course_id_snapshot=course.pk, action="challenge_" + action, changed_fields=["challenge_library"])
    return JsonResponse({"version": str(course.version), "item": {"id": key, **record}})


@endpoint(["POST"])
def progress(request, actor):
    data = payload(request, 2048)
    require(set(data) == {"id", "version", "courseId", "operation", "status", "hints", "projectId"})
    require(isinstance(data["id"], str) and len(data["id"]) <= 100 and type(data["version"]) is int and 1 <= data["version"] <= 10000)
    try:
        operation = str(uuid.UUID(data["operation"]))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError("La operación no es válida.") from None
    require(data["status"] in ("started", "passed", "retry") and type(data["hints"]) is int and 0 <= data["hints"] <= 6)
    require(data["projectId"] is None or isinstance(data["projectId"], str) and actor.projects.filter(pk=data["projectId"], trashed_at=None).exists())
    if data["courseId"]:
        course = course_for(actor, data["courseId"])
        record = course.challenge_library.get(data["id"], {})
        require(not record.get("archived") and record.get("assigned") == data["version"], "La asignación ya no está disponible.")
    else:
        require(data["id"] in {f"capi-reto-{i}" for i in range(1, 18)} and data["version"] == 1)
    key = f'{data["courseId"] or "catalog"}:{data["id"]}:{data["version"]}'
    progress = copy.deepcopy(actor.challenge_progress)
    require(key in progress or len(progress) < 200, "Alcanzaste el límite de 200 registros de progreso.")
    previous = progress.get(key, {"attempts": 0, "hints": 0, "status": "started", "operations": []})
    fingerprint = json.dumps(data, sort_keys=True)
    for done in previous["operations"]:
        if done[0] == operation:
            require(done[1] == fingerprint, "La operación ya se usó con otros datos.")
            return JsonResponse({"progress": previous})
    previous.update({"status": "passed" if previous["status"] == "passed" else data["status"], "hints": max(previous["hints"], data["hints"]), "attempts": previous["attempts"] + (data["status"] != "started"), "projectId": data["projectId"], "updatedAt": timezone.now().isoformat(), "selfAssessed": True})
    previous["operations"] = [*previous["operations"][-19:], [operation, fingerprint]]
    progress[key] = previous
    require(len(encoded(progress)) <= 200000)
    actor.challenge_progress = progress
    actor.save(update_fields=["challenge_progress"])
    return JsonResponse({"progress": previous})


@endpoint(["GET"])
def overview(request, actor, course_id):
    course = course_for(actor, course_id, True)
    prefix = f"{course.pk}:"
    members = User.objects.filter(is_active=True, is_student=True, course_memberships__course=course, course_memberships__role="alumno")
    return JsonResponse({"students": [{"id": str(user.pk), "name": user.display_name, "progress": {key: {k: v for k, v in result.items() if k != "operations"} for key, result in user.challenge_progress.items() if key.startswith(prefix)}} for user in members]})
