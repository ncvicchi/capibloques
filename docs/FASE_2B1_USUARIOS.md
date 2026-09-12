# Fase 2B.1: administración de usuarios

Fecha: 6 de septiembre de 2026. Subfase entregada en DEV tras la confirmación del propietario de que pudo ingresar. No se cambió su cuenta ni su contraseña. Sólo se trabajó en `capi-dev`, mediante SSH directo en LAN; sin usar ni modificar gateway, PRD, router, Proxmox o Nginx.

**Registro histórico de esa entrega.** La [fase 12](FASE_12_MESA_DE_TRABAJO.md) sustituyó las consultas de sesión por foco y la [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente), entregada el 12 de septiembre, sustituyó la operación del editor Node por el runtime estático HTTPS. Seguir esa operación vigente para web/API, manteniendo las garantías del ABM descritas aquí.

## Qué se puede probar

Con el túnel dedicado activo, abrir `http://localhost:3000/cuenta/`, ingresar como administrador y elegir **Gestionar usuarios**. También se puede abrir `/gestion/usuarios/` directamente; sin una sesión administrativa válida no muestra cuentas.

- Crear cuentas con alias, nombre visible, rol y contraseña temporal. Roles: alumno, docente, administrador o administrador y docente. No se requiere email ni existe registro público.
- Buscar por alias/nombre, filtrar por rol o sólo inactivos y recorrer páginas de 20 cuentas.
- Editar con **Guardar/Cancelar**. Cancelar con cambios pendientes pide confirmación; conservar el borrador no modifica la cuenta. Un refresco de sesión de la misma persona no reemplaza lo escrito en el formulario.
- Desactivar/reactivar sin cambiar el UUID. Cambios de alias, rol o estado revocan sesiones anteriores. Cambiar sólo el nombre visible no las revoca.
- Restablecer contraseña temporal sin conocer la anterior; revoca sesiones y exige elegir una definitiva al ingresar. La clave temporal no se persiste en el navegador ni se exporta. Compartirla en privado.
- Eliminar definitivamente, exigiendo escribir el alias exacto y confirmar la advertencia. La baja permanente no tiene Deshacer. Si hay dudas, preferir desactivar.

Prueba manual sugerida: crear una cuenta de ensayo, editar su nombre y cancelar; volver a editar y guardar; desactivarla, buscarla con «Sólo inactivos» y reactivarla. Si no contiene trabajo, probar su eliminación. No hacer el ensayo de baja con la cuenta administradora de uso cotidiano.

## Límites explícitos

Los proyectos siguen siendo borradores locales por UUID, no una biblioteca de servidor. Administrar cuentas no permite ver proyectos ajenos. Antes de una baja, el usuario debe exportar sus proyectos desde su navegador.

«Exportar ficha (sin proyectos)» descarga únicamente metadatos administrativos de esa cuenta, sin contraseña, hash ni token de versión. **No contiene proyectos, no restaura la cuenta y no reemplaza un backup**. Crear otra cuenta con el mismo alias genera otro UUID y no recupera los borradores anteriores. Los archivos JSON exportados fuera de la aplicación no se eliminan con la cuenta.

Docente es un rol de identidad en esta subfase: cursos, membresías y supervisión todavía no están implementados. Pendientes inmediatos, con nuevo OK: 2B.2 colegio/logo; luego 2B.3 cursos/membresías. Avatares, favoritos, biblioteca, ESP-IDF, compilador y USB siguen en sus fases del plan.

## API y protección de cambios

| Ruta | Métodos | Función |
| --- | --- | --- |
| `/api/management/users/` | GET, POST | Listado filtrado/paginado y creación |
| `/api/management/users/<uuid>/` | GET, PATCH, DELETE | Detalle, modificación y baja |
| `/api/management/users/<uuid>/password/` | POST | Contraseña temporal |

- Todos los endpoints comprueban sesión, contraseña definitiva y rol administrador en Django. No dependen de esconder botones. CSRF obligatorio en escrituras; respuestas privadas sin caché.
- Cada mutación relee permisos y época del actor dentro de `access_lock()`, antes de actuar; usa métodos de instancia. El último administrador activo no se puede eliminar, desactivar ni degradar, incluso con cambios concurrentes.
- La API sólo acepta campos, tipos y roles declarados. No permite enviar privilegios Django ni IDs para elegir la identidad de una cuenta nueva. Normalización de alias consistente con el login.
- Modificar, restablecer y eliminar requieren la versión opaca obtenida al leer. Si otra pestaña cambió la cuenta, responde 409 y conserva el formulario: cancelar, actualizar y volver a abrir. También detecta cambios del nombre visible sin forzar una revocación de sesión.
- Ante corte de red durante una escritura, la UI informa que el resultado no se puede confirmar: revisar el listado antes de repetir. No reenvía una baja o un restablecimiento automáticamente.
- Pérdida de sesión/permiso bloquea la pantalla y retira datos privados y diálogos. Desde [fase 12](FASE_12_MESA_DE_TRABAJO.md), la verificación usa el reloj compartido de 60 segundos mientras es visible y conserva cambios explícitos de sesión entre pestañas, sin consultas por foco/visibilidad. Una mutación ya rechazada por la API no espera ese intervalo; se mantiene la expiración conocida.
- `ManagementEvent` registra acción, UUID del actor/destino y nombres de campos cambiados, dentro de la misma transacción. No guarda contraseñas ni valores de campos. Los UUID de auditoría sobreviven a la baja; el registro aún no tiene pantalla de consulta. Definir retención antes del piloto.

Antes de incorporar cursos, proyectos o comentarios, revisar la eliminación de cuentas y sus relaciones: añadir conteos, respaldo real y confirmación del alcance; no introducir cascadas silenciosas. No extrapolar el ABM actual a una biblioteca que aún no existe.

## Operación en DEV

La entrada normal de DEV es HTTPS; para estado, mantenimiento y recuperación de web/API seguir la [operación vigente de fase 13](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). El túnel se conserva para recuperación. Desde la PC, estando realmente en LAN y con su configuración SSH privada existente:

```powershell
.\scripts\connect-dev.ps1 -DirectLan
```

El modo LAN anula ProxyCommand/ProxyJump sin cambiar la configuración privada, mantiene la verificación de host y expone sólo `127.0.0.1:3000` en la PC. Sin el parámetro conserva el acceso remoto configurado previamente. No abrir un segundo túnel sobre el mismo puerto. El túnel se mantiene separado de la sesión de administración.

Se creó una copia lógica PostgreSQL en formato custom, no vacía, bajo el directorio privado de respaldos del usuario de la VM **antes** de aplicar `accounts.0002_managementevent`. La migración es aditiva y no cambia contraseñas/cuentas existentes. La copia queda en esa VM: no es aún backup externo ni un ensayo de restauración. No borrar volúmenes ni regenerar secretos para recuperar el acceso.

Durante la actualización en caliente de las dependencias de UI, el kernel registró un OOM del contenedor `editor` y Docker lo reinició. La primera prueba Chrome quedó esperando hidratación y falló. No se aumentaron RAM, límites ni timeouts. Con el servidor estabilizado pasaron las 16 pruebas siguientes de Chrome/Edge. Es una limitación observada del servidor de desarrollo en la VM de 2 GB, no una medición de capacidad de producción.

La corrección operativa adoptada en ese cierre fue detener el frontend Node antes de instalar dependencias, evitando HMR sobre un checkout en actualización. **La receta de dos Compose quedó sustituida por fase 13:** no iniciar `editor` manualmente ni instalar dependencias dentro del Nginx actual. Confirmar `hostname` = `capi-dev`, conservar el túnel y preparar la ventana de mantenimiento según la [operación vigente](FASE_13_ACCESO_EXTERNO_DEV.md#operación-vigente). No correr pruebas mientras se despliega.

No iniciar otro servidor para aparentar que DEV responde. Si vuelve a reiniciarse sin despliegue, revisar eventos y OOM antes de aumentar recursos, sin divulgar datos privados de logs. El acceso externo DEV se entregó en fase 13; PRD sigue en la Fase final postergada.

## Evidencia de validación

- DEV con PostgreSQL real: **51/51 pruebas backend**, incluidas 14 nuevas de ABM. Datos ficticios en la base de tests, sin crear cuentas de ensayo en la base de la aplicación ni usar la contraseña del propietario. Sin migraciones pendientes; API saludable después del despliegue.
- Chrome instalado contra DEV: **8/8**. Edge instalado contra DEV: **8/8**. Siete contratos de interfaz por navegador y un caso con API real sin sesión. Sin reintentos automáticos. Cubren crear/guardar, filtros, cancelar/descartar, recuperación de contraseña, baja explícita/exportación de ficha, conflicto, revocación, caída de red y formulario a 390 px con texto al 200%.
- Los contratos UI interceptan la API exclusivamente dentro de Playwright; los permisos y las mutaciones reales se comprueban por separado en Django/PostgreSQL. No se habilitó un modo invitado ni un bypass en la aplicación.
- CI completo del código `8dc35ce`: **51 pruebas backend y 33 de interfaz**, typecheck, lint, smoke JSON/simulador/historial, auditoría de dependencias, dos compilaciones Arduino para Wemos y build estático con rutas de cuenta/gestión. [Ejecución aprobada](https://github.com/ncvicchi/capibloques/actions/runs/34064329843).
- El script de túnel LAN pasó el análisis sintáctico PowerShell y se verificó el acceso directo a DEV conservando `localhost:3000`.
- Cierre visual: corregidos el contraste de las acciones primarias y los colores del panel usando las variables reales del proyecto; captura final inspeccionada. Se reutilizan los controles accesibles y no se modifican sus implementaciones vendorizadas.
- **Código final `f0fe8e6`: 28/28 pruebas de cuenta y gestión en Chrome/Edge contra DEV**, sin reintentos, incluyendo dos casos de API real por navegador. DEV actualizado con arranque limpio del frontend, saludable y sin nuevos reinicios durante la corrida. [CI final completo aprobado](https://github.com/ncvicchi/capibloques/actions/runs/34064918966), con las 51 pruebas backend, 33 de interfaz y ambas compilaciones Wemos. El commit posterior sólo incorpora esta evidencia documental.

La guía de Sites influyó en la reutilización de diálogos, radios, casillas y tablas accesibles del proyecto, sin adoptar su hosting ni almacenamiento: la infraestructura elegida sigue siendo Proxmox con Django/PostgreSQL.
