# Fase 2B.2: identidad del colegio antes del ingreso

Fecha: 6 de septiembre de 2026. Alcance: nombre y logo de una institución por instalación, visibles antes de ingresar y administrables desde la web. Sólo DEV; sin cambios en PRD, gateway, Proxmox, Nginx, router ni Pages. No se modificaron credenciales ni se publicó una marca ficticia en la base de la aplicación.

## Cómo usarlo

1. Ingresar como administrador y abrir **Mi cuenta → Configurar colegio**, o `http://localhost:3000/gestion/colegio/` con el túnel dedicado activo.
2. Elegir **Editar colegio**, escribir el nombre y, opcionalmente, seleccionar un logo autorizado por el colegio. No usar fotos de alumnos.
3. Revisar la vista previa. No se publica mientras se está editando. **Guardar colegio** aplica nombre y logo juntos. **Cancelar** pide confirmar si hay cambios pendientes.
4. Abrir `/cuenta/` en otra pestaña o ventana privada para comprobar la marca antes del ingreso. Al volver a una pestaña de cuenta ya abierta se vuelve a consultar la identidad pública.

Se puede usar sólo el nombre, reemplazar el logo, quitarlo o recuperar en el borrador el logo actualmente guardado. Quitar requiere Guardar para hacerse efectivo. Si una selección local no cumple formato/tamaño, se conserva la anterior. Si el servidor rechaza el archivo, conserva tanto nombre como logo previos y muestra el error sin cerrar el formulario.

El nombre admite entre 1 y 100 caracteres, en una sola línea. Sin configuración se conserva la identidad CapiBloques; no se inventa el nombre/logo del colegio. La ausencia o falla del recurso visual no bloquea alias y contraseña: el nombre sigue legible cuando está disponible.

## Archivos y persistencia

- PNG, JPEG o WebP fijos, hasta 2 MiB. Máximo 2048 píxeles por lado y 4 millones de píxeles totales. No admite SVG, GIF, animaciones, URLs externas ni descargas desde otros servidores.
- La API compara el formato declarado con el detectado, verifica y decodifica el archivo completo. Recodifica un PNG de hasta 512 × 512, preservando proporciones, orientación y transparencia; no recorta ni estira.
- Se genera una imagen nueva desde los píxeles: no se publican metadatos EXIF/autor/localización, perfiles, comentarios, nombre de archivo ni contenido anexado al original. El PNG final tiene límite de 1 MiB. No es una garantía de quitar información escondida en los propios píxeles.
- El límite del cuerpo de carga se aplica antes del parser multipart/CSRF, incluso sin sesión; límites de campos/archivos y decodificación acotan recursos. El resto de peticiones mantiene el límite pequeño de datos de fase 2A. Las imágenes grandes o dañadas no alteran la configuración.
- **Decisión para esta VM:** el único logo optimizado se guarda como `bytea` en PostgreSQL junto al nombre, no en un nuevo almacenamiento de objetos. El volumen persistente existente y un `pg_dump` incluyen ambos de forma consistente. Esto evita respaldos descoordinados entre archivos y base para una sola imagen pequeña; no es el diseño para adjuntos grandes o galerías futuras.
- `school.0001_initial` agrega configuración y auditoría sin modificar cuentas. Se creó una copia lógica previa, no vacía, en el directorio privado de respaldos de DEV. Las copias siguen dentro de esa VM: el backup externo y el ensayo de restauración integral continúan pendientes antes del piloto.

Pillow 12.3.0 quedó fijado como dependencia backend. Referencias técnicas verificadas: [seguridad del procesamiento de imágenes](https://pillow.readthedocs.io/en/stable/handbook/security.html), [módulo Image](https://pillow.readthedocs.io/en/stable/reference/Image.html), [versión utilizada](https://pillow.readthedocs.io/en/stable/releasenotes/12.3.0.html) y [límites de carga de Django](https://docs.djangoproject.com/en/5.2/ref/settings/#data-upload-max-memory-size).

## API y permisos

| Ruta | Acceso | Función |
| --- | --- | --- |
| `GET /api/school/` | Público | Sólo `name` y `logoUrl`; sin usuarios, cursos, autor ni configuración privada |
| `GET /api/school/logo/<digest>/` | Público | Sólo el PNG vigente; tipo fijo, `nosniff`, CSP restrictiva y sin caché |
| `GET /api/management/school/` | Administrador con contraseña definitiva | Configuración/versionado y contexto administrativo |
| `POST /api/management/school/` | Mismo permiso + CSRF | FormData con `name`, `version`, `logoAction`; archivo `logo` sólo al reemplazar |

La API revalida al actor dentro de `access_lock()` después de decodificar la imagen y antes de escribir. La versión impide que una pestaña desactualizada sobrescriba otra edición; responde 409. Cancelar permite cargar la versión actual sin publicar el borrador anterior. Guardar la marca no cambia roles, contraseñas ni sesiones del administrador.

El nombre y logo se escriben en la misma transacción que `SchoolEvent`: UUID del actor y nombres de campos cambiados, sin contenido del archivo. Eliminar una cuenta no elimina la identidad del colegio ni la auditoría: conserva el UUID de referencia del actor, sin cascadas sobre la configuración.

La URL del logo incluye un digest del PNG; al reemplazar/quitar la imagen, la URL anterior devuelve 404. Esto no revoca copias que alguien ya hubiera descargado: el logo es público. Las respuestas no contienen rutas del servidor ni sirven el archivo original.

## UX y recuperación

- Reutiliza los controles accesibles del proyecto, siguiendo la guía de Sites, pero no su hosting ni su autenticación. Vista previa con proporciones reales, nombre largo ajustable y sin depender del color para comunicar errores.
- Borrador de nombre/archivo sólo en memoria. Las URLs temporales de vista previa se liberan; no se guarda la imagen seleccionada en localStorage ni se publica al perder foco.
- Cancelar/salir desde Mi cuenta confirma el descarte. Recargar/cerrar con cambios pendientes activa el aviso del navegador cuando éste lo permite; un descarte ya confirmado no debe volver a preguntar.
- Al recuperar foco se verifica el permiso sin reemplazar el borrador de la misma cuenta. Cambio de identidad o revocación retira formulario y diálogos privados. Una falla de conexión bloquea la edición hasta verificar de nuevo y conserva el borrador de esa cuenta.
- Si se interrumpe una escritura, el cliente no afirma que se guardó ni reenvía automáticamente: indica cancelar/cargar lo guardado antes de repetir. Los cambios ya guardados no tienen un historial restaurable en esta subfase.

## Verificación

- Build estático, typecheck y lint aprobados; se verifica la ruta anidada `/gestion/colegio/` y sus assets desde raíz.
- **66/66 pruebas backend en DEV con PostgreSQL**, incluidas 15 nuevas. Archivos y cuentas de prueba sólo en la base aislada de tests. Cubren permisos, CSRF, límites previos al parser, formatos, animación, corrupción, orientación, metadatos, proporciones, persistencia de bytes, conflictos, revocación durante la validación y conservación de la institución al eliminar al actor.
- Primera corrida Chrome contra DEV: **9/9**, incluyendo API pública/privada real sin interceptar. Los contratos UI simulan respuestas exclusivamente desde Playwright; la aplicación no incluye bypass de sesión ni modo invitado.

La evidencia final de navegador/CI se incorpora al cerrar esta entrega. La siguiente subfase es **2B.3: cursos y membresías**, pendiente de nuevo OK. Biblioteca de proyectos, supervisión pedagógica, avatares, favoritos, ESP-IDF, compilación y USB conservan su lugar en el plan.
