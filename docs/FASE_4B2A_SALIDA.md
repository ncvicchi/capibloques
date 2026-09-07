# Fase 4B.2a: salida en computadoras compartidas

Subfase acotada del 7 de septiembre de 2026, autorizada después de recuperar el acceso del propietario. Implementada y probada en DEV. **No completa toda 4B.2**: el comportamiento ante desconexión queda en 4B.2b, con otro OK. Historial y recuperación del borrador de Armar escena siguen en 4C.

## Uso

Cerrar sesión desde el editor o Mi cuenta abre **Antes de salir**. Cerrar todas mis sesiones utiliza el mismo flujo y aclara su alcance.

- **Cancelar** conserva cuenta y copias. Desde el editor, se vuelve a verificar la sesión antes de permitir continuar. El simulador queda pausado; no se reinicia automáticamente.
- **Salir y conservar copias** mantiene la recuperación por cuenta de 4B.1. No envía los proyectos al servidor: para hacerlo, cancelar y usar Guardar.
- **Revisar y exportar las copias JSON** permite descargar individualmente los documentos, incluidos los borradores anteriores de esa cuenta. Los nombres llevan un número para distinguir copias con el mismo título. Comprobar los archivos en Descargas; iniciar una descarga no demuestra que el usuario la conservó.
- **Salir y quitar copias** requiere marcar una casilla que confirma el descarte sin deshacer de todos los documentos y envíos pendientes listados de esa cuenta en ese navegador. Se cierra la sesión y, sólo tras confirmación del servidor, se retira el conjunto confirmado.
- La opción **Actualizar copias antes de salir** renueva la vista previa y desmarca la confirmación. Si otro escritor cambia el conjunto después, la limpieza se rechaza en lugar de borrar cambios no revisados.

El estado de cada copia distingue: sólo local, cambios locales, envío sin confirmar o coincidencia con el último guardado confirmado. Esa coincidencia no es una consulta actual al servidor ni garantía de que el proyecto siga disponible allí. Los JSON contienen el proyecto portable, no la operación pendiente, la cuenta ni la asociación a la biblioteca. Se recuperan mediante la importación JSON existente.

## Datos que se conservan y límites

- Nunca se eliminan proyectos de PostgreSQL, cuentas, cursos ni permisos. No hay borrados en la API de proyectos como parte de la salida.
- La limpieza afecta únicamente los documentos de IndexedDB del UUID confirmado, los dos borradores legacy de esa cuenta en localStorage y la referencia de recuperación de esta pestaña. Se mantienen preferencias locales, metadatos mínimos de invalidación y datos de otras cuentas.
- El antiguo borrador anónimo anterior a las cuentas se conserva: no se puede suponer que pertenece a quien sale. También permanecen archivos JSON descargados y copias en otros perfiles, orígenes, dispositivos o respaldos del navegador. Cerrar todas las sesiones no permite limpiar esos equipos remotamente.
- No es un borrado seguro del disco ni una barrera contra acceso físico al perfil del sistema. Para mayor aislamiento, usar perfiles separados. No se implementa limpieza automática al apagar, cerrar una pestaña, expirar o perder una sesión: hacerlo podría destruir pendientes sin revisión.
- Armar escena continúa con Guardar/Cancelar explícitos. Antes de salir desde otra pestaña, confirmar la escena en su editor: su borrador interno todavía no forma parte del documento recuperable.
- No se añade modo offline ni autenticación local. Al no poder verificar la sesión, se oculta el contenido y se permite reconectar. Un cierre de sesión sin confirmación permanece como fallo; no se afirma que ya sea seguro dejar la computadora.

## Garantías técnicas

1. La salida del editor captura y confirma el cambio local más reciente antes de abrir las opciones. Si falla, mantiene la oportunidad de exportar desde el editor, sin iniciar logout ni limpieza.
2. Mientras se revisa la salida se pausa ese editor y se avisa a otras pestañas. La señal se renueva mientras el diálogo está vivo; no es un candado distribuido ni una garantía de entrega a pestañas congeladas. Se verifica la sesión en el diálogo, al recuperar foco y periódicamente. Nunca se incluyen credenciales ni documentos en las señales.
3. La vista previa de IndexedDB lee documentos y metadatos en una transacción coherente. La limpieza comprueba el conjunto exacto, sus revisiones y la época dentro de una transacción de escritura; solicita durabilidad estricta y espera `oncomplete`. Un aborto no se informa como éxito.
4. Retirar las copias incrementa una época local por cuenta. Escritores del editor que leyeron una época anterior fallan, aunque no hayan recibido el aviso entre pestañas; no bifurcan ni vuelven a crear los documentos retirados. Conservar esta comprobación en futuras escrituras y recuperaciones. Una sesión recién cargada puede crear trabajo nuevo.
5. Cada limpieza tiene identidad. Repetir la misma operación confirmada no borra trabajo nuevo. Los borradores legacy se comparan antes y después de la transacción IndexedDB; los dos almacenes no forman una transacción conjunta. Si cambia un legacy o falla su retirada después de limpiar IndexedDB, se informa limpieza incompleta; no se revierte ni se afirma atomicidad global.
6. Logout mantiene CSRF y añade precondición opcional `X-Capi-Account`. Si la cuenta cambió entre la lectura y el POST, el servidor rechaza la salida equivocada. Cerrar todas las sesiones revalida también estado/época dentro de `access_lock()`.
7. Si el servidor cierra sesión pero la limpieza local falla, el diálogo retira el listado y explica que quedaron copias: volver a ingresar y revisarlas. Si se perdió la respuesta de logout, el reintento consulta la sesión y confirma el cierre antes de limpiar. Si no se puede confirmar que se cerraron todas las sesiones remotas, lo informa por separado.

Las pestañas con código anterior al soporte de épocas deben recargarse; no se puede añadir retroactivamente esa protección al JavaScript que ya ejecutan. No hay migración SQL ni cambio de formato JSON, dependencias o generadores.

## Validación

Las pruebas de UI utilizan cuentas/proyectos sintéticos interceptados en Playwright, nunca credenciales del propietario ni borrados en cuentas reales. El backend se prueba en una base de tests separada.

- Tipos, lint, smoke JSON/generador/simulador/historial local y autoguardado: aprobados, sin dependencias nuevas.
- DEV: `check`, consistencia de migraciones y **120 pruebas Django/PostgreSQL aprobadas** en 13,8 segundos. Incluyen la precondición de cuenta en ambos tipos de logout y la revocación dentro del bloqueo de logout-all. Se conservó la base de tests; no se recrearon API/base ni se cambiaron cuentas reales durante esta comprobación.
- La primera ronda encontró el diálogo desplazado fuera de pantalla a texto 200% por combinar dos traslaciones CSS. Se corrigió el posicionamiento compartido de los diálogos de sesión y se evitó replegar el contenido en cada verificación periódica. La prueba se repitió en Chrome y Edge: ambas aprobadas con casilla y acciones alcanzables, sin clics forzados ni aumento de tolerancias. Captura inspeccionada; se usa desplazamiento vertical cuando el contenido no cabe.
- Ronda final contra DEV sobre `b810cb7`: **50/50 pruebas aprobadas en Chrome y Edge, sin reintentos, en 6,8 minutos**. Incluye conservar/reingresar/reintentar la operación original sin duplicar el proyecto, cancelar, exportar/quitar con confirmación, preservación de otros usuarios/servidor/legacy anónimo, conflicto de otra pestaña, bloqueo de escritores viejos, aborto transaccional, respuesta perdida de logout, cierre desde Mi cuenta y regresiones de acceso/importación. Los fallos de la ronda anterior no se presentan como aprobados.
- [CI final del código `b810cb7` aprobado](https://github.com/ncvicchi/capibloques/actions/runs/34142259733): **100 pruebas Chromium**, 120 Django/PostgreSQL con comprobación de persistencia, auditoría sin vulnerabilidades informadas, dos sketches compilados para Wemos D1 R32 y build estático aprobado. Las 100 pruebas de interfaz finalizaron sin fallos ni reintentos informados. El build no publica el sitio.
- Readiness y Mi cuenta responden HTTP 200. Editor, API y PostgreSQL saludables, sin OOM ni reinicios automáticos. Muestra puntual al finalizar las pruebas: editor ~966 MiB, API ~67 MiB y PostgreSQL ~26 MiB, dentro de los límites existentes. No es una prueba de carga.

Repetir contra DEV, con el túnel dedicado activo y Chrome/Edge instalados:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
$env:PLAYWRIGHT_CHROME = '1'
$env:PLAYWRIGHT_EDGE = '1'
npm run test:e2e -- tests/session-exit.spec.ts tests/editor-access.spec.ts tests/accounts.spec.ts --project=chrome --project=edge --workers=1 --max-failures=1
```

En `capi-dev`, `sudo sh scripts/verify-backend-dev.sh` verifica el backend sin la opción de recrear servicios. Se usaron ambos Compose para actualizar DEV con el editor detenido y se esperó salud antes de probar. Sin cambios en PRD, Proxmox host, gateway, router, Nginx, Pages ni Sites. No se ensayó una clase concurrente, apagón o borrado físico del perfil.

## Punto de control del propietario

1. Recargar el editor de DEV. Modificar un proyecto de prueba, elegir Cerrar sesión y Cancelar: debe conservarse lo escrito.
2. Volver a salir, desplegar las copias y exportar una. Elegir conservar copias; al ingresar de nuevo debe poder recuperarse.
3. Sólo con copias de prueba que ya no se necesiten o se hayan exportado: salir, revisar el listado, marcar el descarte y elegir quitar copias. Al ingresar, no deben reaparecer esas copias locales; los proyectos guardados en Mis proyectos deben seguir allí.

Detenerse para probar esta subfase. Siguiente paso propuesto, pendiente de OK: **4B.2b, comportamiento ante desconexión**, sin confundir disponibilidad del proyecto local con autorización vigente.
