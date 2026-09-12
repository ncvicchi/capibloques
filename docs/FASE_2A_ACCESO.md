# Fase 2A: acceso y sesiones

Fecha: 6 de septiembre de 2026. Primer paso de la fase 2 autorizada: modelo propio de usuario, ingreso por alias, cambio de contraseña y sesiones revocables. **No es la fase 2 completa**: ABM web, colegio/logo, cursos y membresías se entregarán en 2B, con nuevo OK.

Actualización posterior: el propietario confirmó acceso recuperado y autorizó continuar. El ABM web ya está entregado en [fase 2B.1](FASE_2B1_USUARIOS.md). Las referencias de este documento al ABM futuro describen el cierre histórico de 2A; colegio/logo y cursos siguen pendientes.

## Qué se puede probar

Abrir `http://localhost:3000/cuenta/` con el túnel dedicado activo. El enlace «Mi cuenta» del editor abre una pestaña aparte para no interrumpir el proyecto en edición. La pantalla permite ingresar, mostrar/ocultar contraseña, ver la identidad y roles propios, cambiar contraseña con Guardar/Cancelar, cerrar esta sesión o todas las sesiones.

No pide correo ni ofrece registro público. Sin API disponible muestra error y Reintentar, sin fingir un ingreso. Una contraseña temporal obliga a elegir otra antes de cualquier futura operación protegida de la cuenta. Al recuperar foco o recibir un aviso entre pestañas se consulta nuevamente la sesión; no se comparten credenciales por ese canal.

**Ampliación 2A autorizada: ingreso obligatorio y borradores locales por cuenta.** `/` verifica una sesión real en Django antes de montar Blockly o leer un proyecto. Sin sesión envía a `/cuenta/?editor=1`; ingresar (y cambiar la contraseña temporal, cuando corresponda) devuelve al editor. Cada cuenta guarda un borrador por UUID, independiente del alias, y mantiene importación/exportación JSON. No sube proyectos al servidor ni sincroniza computadoras: biblioteca, permisos docentes por proyecto y guardado servidor siguen en fases 3/4.

El editor ofrece «Cerrar sesión», pausa el simulador y los sonidos, captura los cambios confirmados antes de cancelar el autoguardado pendiente y retira el proyecto de pantalla. Si falla el guardado de una salida voluntaria, conserva el editor y ofrece exportar; no oculta ese error. Verifica de nuevo al recuperar visibilidad/foco y cada 15 segundos mientras esté visible. Los cambios de sesión avisan a otras pestañas por BroadcastChannel y evento de storage, sin compartir credenciales. No es revocación instantánea entre equipos: la próxima petición detecta la revocación del servidor. Ante error de red se bloquea la edición y se permite reintentar, sin fingir un cierre exitoso ni perder en memoria el borrador de escena de la misma sesión. Una sesión nueva descarta diálogos sin confirmar: usar Guardar/Cancelar en Armar escena antes de salir. Los archivos leídos durante una verificación esperan a la misma sesión; si cambia la cuenta, no se importan en la nueva.

Los antiguos `capibloques-project-v2/v1` no se cargan ni borran automáticamente. En Mi cuenta, el administrador puede descargar una copia mediante «Recuperar proyecto anterior a las cuentas» e importarla explícitamente si es suya. Un alumno no recibe ese proyecto por ser el primero que entra.

**Límite de privacidad:** los borradores continúan en localStorage, en texto claro. La separación evita mezclas en la interfaz, no protege contra alguien con acceso a las herramientas del navegador o al mismo perfil del sistema operativo. Exportar copias y no usar todavía este DEV como biblioteca definitiva de alumnos. Dos editores de la misma cuenta todavía pueden sobrescribir el borrador por último guardado: resolución de conflictos e historial pertenecen a fases 3/4.

## Primera cuenta: intervención del propietario

Alias elegido por el propietario: `administrador`; nombre visible: `Administrador`. Se almacena el alias en minúsculas, y se puede ingresar usando mayúsculas. **No se asigna ni publica una contraseña predeterminada.** El propietario informó que completó el bootstrap y se verificó que hay un administrador activo en DEV, sin leer ni modificar su contraseña. Los tests utilizan una base separada y no dejan cuentas reales. El comando de abajo queda como guía de instalación; repetirlo no reemplaza una cuenta existente.

Desde PowerShell, en el checkout de CapiBloques:

```powershell
.\scripts\setup-dev-admin.ps1
```

El script usa la configuración SSH privada preexistente, sin reenviar agente ni abrir comandos en el gateway. SSH/sudo pueden pedir primero la contraseña de la VM. Después el comando de aplicación pide alias, nombre visible y **una contraseña nueva elegida por el propietario**, dos veces, sin mostrarla. La contraseña de la aplicación no tiene por qué coincidir con SSH/sudo.

Requiere al menos diez caracteres; no puede ser sólo numérica, muy común o similar a alias/nombre. Una frase es válida; no se obliga a símbolos arbitrarios. La creación es única y transaccional: repetir el comando no reemplaza al administrador ni cambia su contraseña. El administrador cotidiano no es un superusuario técnico de Django.

Corrección del asistente: muestra las reglas antes de pedir la contraseña y explica cada rechazo. Permite reintentar sin volver a ingresar alias/nombre, también si falla la confirmación; Ctrl+C cancela sin guardar nada. Valida un máximo de 256 caracteres, coherente con el ingreso web. El mismo flujo se usa al restablecer una contraseña: no se modifica la cuenta ni se revocan sesiones hasta confirmar una contraseña válida. Si no puede ocultar la escritura en la terminal, se detiene sin pedirla con eco.

Equivalente desde una sesión SSH en `capi-dev`:

```bash
test "$(hostname)" = capi-dev || exit 1
cd /home/capi/capibloques
sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml exec api python manage.py bootstrap_admin
```

Si se pierde una contraseña, el propietario con acceso operativo puede restablecer **una cuenta existente**, sin cambiar sus roles ni reactivarla:

```bash
sudo docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml exec api python manage.py reset_account_password administrador
```

Pide una contraseña temporal sin mostrarla, revoca las sesiones y obliga a cambiarla al ingresar. No poner contraseñas en argumentos, variables de shell, archivos de prueba, chat o Git. Las cuentas adicionales y su ABM web todavía no se habilitan en este paso.

## Contrato y protecciones

| Ruta | Método | Comportamiento |
| --- | --- | --- |
| `/api/auth/session/` | GET | Identidad propia o `null`, y token CSRF en respuesta no cacheable |
| `/api/auth/editor-session/` | GET | 401 sin sesión, 403 con contraseña temporal; identidad verificada y marca opaca del ciclo de sesión, nunca una credencial |
| `/api/auth/login/` | POST | Alias/contraseña, cookie de sesión y rotación de CSRF |
| `/api/auth/password/` | POST | Contraseña actual, nueva y confirmación; conserva esta sesión, invalida las demás |
| `/api/auth/logout/` | POST | Cierra sólo esta sesión, también es seguro repetirlo |
| `/api/auth/logout-all/` | POST | Invalida todas las sesiones de la cuenta |

- Todas las escrituras, incluido login, pasan por CSRF. No se habilita CORS ni se confían cabeceras de identidad del navegador. Cookies HttpOnly/SameSite; el token CSRF en memoria no es una credencial de identidad.
- `accounts.User` basado en `AbstractUser` desde su migración inicial, con UUID, alias normalizado único, nombre visible, roles y estado. **No se creó `auth_user`**. Roles permiten administrador + docente, o alumno; no combinación alumno/administrador. El acceso docente a cursos/proyectos aún no existe y no se infiere de estos flags.
- Hash PBKDF2 de Django, con sal. Las respuestas nunca incluyen hash, contraseña ni lista de usuarios. Errores de login no distinguen alias inexistente, clave errónea o cuenta inactiva.
- Una época de sesión se incrementa al cambiar acceso, contraseña, alias o roles, incluso desactivar y reactivar antes de la siguiente petición. Django valida el hash de sesión al leer al usuario. No almacenar identidad/autorización en localStorage.
- El último administrador activo se protege bajo bloqueo transaccional PostgreSQL, incluido un ensayo de dos cambios simultáneos. Las futuras mutaciones de cuentas deben pasar por `access_lock()` y los métodos de instancia; **no usar `QuerySet.update/delete` ni operaciones bulk para modificar acceso**. Este bloqueo no concede autorización: el futuro ABM debe verificar además actor y permisos.
- `require_account` comprueba autenticación, cambio obligatorio de contraseña y roles en el servidor. Los futuros permisos por curso/proyecto deben añadirse expresamente; no asumir que un rol da acceso a todo.
- Login: hasta 8 intentos por alias y 120 por IP en una ventana de 5 minutos, contados también entre sesiones; cambio de contraseña: 8 por cuenta. Contadores persistentes en PostgreSQL, claves pseudonimizadas, limpieza de contadores de más de un día al atender intentos admitidos. `X-Forwarded-For` no permite eludirlos. **En DEV todas las conexiones vía Vite comparten IP de proxy**; la [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md) debe resolver la cadena de proxies y ajustar límites con pruebas antes de publicar DEV, y la Fase final debe revalidarlo para PRD. No copiar la topología sin revisión.
- Sesiones de hasta 8 horas, cookie de sesión de navegador; restaurar pestañas puede conservarla según el navegador, por lo que «Cerrar sesión» es la acción explícita en una PC compartida. Eventos mínimos de login/logout/cambio/bootstrap/recuperación, sin cuerpos de peticiones ni contraseñas. Planificar limpieza periódica de sesiones expiradas y retención de eventos antes del piloto.
- DEV sigue con HTTP sólo en loopback por SSH mientras fase 13 no esté implementada. No habilitar acceso público sin HTTPS, cookies Secure, protección administrativa adicional y la configuración/restricciones de la [guía de acceso externo](FASE_13_ACCESO_EXTERNO_DEV.md).

Referencias de las decisiones: [modelo de usuario propio](https://docs.djangoproject.com/en/5.2/topics/auth/customizing/), [sesiones y contraseñas](https://docs.djangoproject.com/en/5.2/topics/auth/default/), [CSRF en Django](https://docs.djangoproject.com/en/5.2/howto/csrf/).

## Migración, copia previa y operación

Se creó una copia lógica PostgreSQL previa a la migración en el directorio privado `/home/capi/.local/share/capibloques-backups/`, fuera de Git. Se conserva; no se borró ni reinició el volumen. **Es una copia local previa, no un respaldo externo ni una restauración integral ensayada.**

Se aplicaron `contenttypes`, migraciones de permisos `auth` y `accounts.0001_initial`; se conserva `sessions.0001_initial`. No se reescriben migraciones ya aplicadas ni se crean cuentas desde una migración. El procedimiento completo de actualización sigue en [fase 1](FASE_1_BASE_REPRODUCIBLE.md), usando ambos archivos Compose y migración explícita.

El build estático ahora utiliza assets desde la raíz del dominio propio; se comprueba `/cuenta/index.html` y las referencias de cada HTML. Ya no usa el ajuste de rutas relativas para subdirectorios de Pages. No se reactivó Pages ni otro hosting.

## Pruebas de esta entrega

```bash
sudo sh scripts/verify-backend-dev.sh --restart
```

Comprueba migraciones pendientes y desajustes entre modelos/migraciones, **28 pruebas Django con PostgreSQL real** y persistencia del registro de migración tras recrear API/base. Incluye roles, alias, CSRF/origen, entradas inválidas, límites persistentes, hash real, cambios de contraseña, sesiones entre dos clientes, desactivación/reactivación, recuperación local y último administrador con cambios simultáneos. Los tests rápidos usan un hash sólo de pruebas; otro caso comprueba el PBKDF2 configurado realmente.

Las pruebas `tests/accounts.spec.ts` distinguen explícitamente:

- Cinco contratos de UI con respuestas controladas: errores/reintento, Guardar/Cancelar, contraseña temporal, caída del servidor y texto al 200% en 390 px.
- Un caso `API_REAL`, sin interceptar la red, con sesión anónima y rechazo de login inválido contra la VM. El ingreso correcto real, cambio de contraseña y revocación se prueban en Django con base real; el ingreso positivo desde el navegador del propietario queda para crear su administrador y probarlo.

Para ejecutar los seis casos en Chrome y Edge contra la VM, con el túnel activo:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
$env:PLAYWRIGHT_API = '1'
npm run test:e2e -- tests/accounts.spec.ts --project=chrome --project=edge --workers=1 --max-failures=1
```

Durante las pruebas se corrigieron una aserción de test que trataba `JsonResponse` como cliente HTTP y un desborde con texto ampliado. Una corrida Chrome por SSH quedó antes de hidratar la página, con módulos JavaScript sin terminar; no era un rechazo de autenticación. Se conserva como limitación observada del acceso remoto de desarrollo, sin aumentar timeouts ni reintentos para ocultarla.

Corrida final contra DEV: **12/12 aprobadas en Chrome y Edge, sin reintentos** (seis por navegador, de los cuales uno por navegador usa API real). CI completo del código `0bbb1db` aprobado: 28 pruebas backend con persistencia, 16 casos Chromium, typecheck, lint, smoke, audit, compilación Wemos y build estático. [Ejecución verificada](https://github.com/ncvicchi/capibloques/actions/runs/34044781581).

Cierre de 2A inicial: se entregó con commit/push y se solicitó crear `administrador` y probar ingreso/contraseña/cierre. El propietario completó ese paso y luego autorizó la ampliación documentada abajo; 2B no comenzó.

## Validación de la ampliación: editor con ingreso obligatorio

- Backend: **37/37 pruebas en DEV con PostgreSQL real**, sin migraciones nuevas. La nueva ruta exige sesión del servidor, rechaza contraseña temporal y revocación, no acepta identidad enviada por el cliente ni su marca opaca como credencial. Se conserva el administrador del propietario; no se usó su contraseña en las pruebas.
- Chrome contra DEV: 7 contratos nuevos de acceso/separación/recuperación; luego 9 casos de regresión, incluidos tres con API real sin interceptar; y 3 casos de salida, fallo de red y cuota de almacenamiento. Todos aprobados sin reintentos.
- Edge contra DEV: 6 casos aprobados sin reintentos, incluidos dos con API real, separación de borradores, cierre desde otra pestaña y recuperación con un diálogo de escena abierto.
- Importación durante verificación: **4/4 casos finales aprobados en Chrome y Edge**, comprobando que el archivo continúa en la misma sesión pero no pasa a otra cuenta. Sin reintentos.
- Los contratos UI simulan identidad sólo mediante rutas de Playwright. La aplicación no tiene modo invitado ni bypass de autenticación. Las pruebas antiguas se actualizaron para que la sesión simulada cambie realmente tras login/password/logout; el primer CI detectó esa inconsistencia y no se aumentaron tiempos ni reintentos.
- Typecheck, lint, smoke del simulador/JSON/historial y build estático aprobados. CI completo de `7801fa0` aprobado, con 37 pruebas backend, 23 casos de interfaz y compilación Wemos: [ejecución](https://github.com/ncvicchi/capibloques/actions/runs/34047180911). Las protecciones posteriores de cuota/importación tienen sus pruebas específicas.
- **Cierre final:** CI completo de `0dd5350` aprobado, incluidas las protecciones de cuota e importación: 37 pruebas backend, 26 casos de interfaz, compilación Wemos y build estático. [Ejecución final del código](https://github.com/ncvicchi/capibloques/actions/runs/34047640363). DEV actualizado al mismo código; el commit posterior sólo registra esta evidencia.

DEV mantiene el puerto exclusivo loopback y el túnel dedicado. No se modificaron PRD, gateway, router, Nginx ni Pages. La próxima fase sigue siendo 2B y requiere un nuevo OK. Validación manual: recargar `/`, salir si había una sesión activa y comprobar que se pide alias antes de volver al editor.
