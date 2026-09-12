# Plan de CapiBloques: multiusuario, enseñanza y programación de Wemos

Estado: **fases 0–9 y 11–13 implementadas y verificadas en DEV**. La fase 10 conserva aceptación física pendiente por falta de Wemos. La [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md) publicó DEV de forma persistente y segura; las fases 14–18 requieren autorización. Producción es la **Fase final**, postergada. El [contexto vivo](CONTEXTO_PARA_CONTINUAR.md) contiene el detalle y la evidencia vigente.
Fecha de actualización: 12 de septiembre de 2026.
Backlog posterior: [pedidos completos](BACKLOG.md), asignados a las [fases 12–18](PLAN_FASES_BACKLOG.md), precedidas por la fase 11 de contexto portable. Las fases 12 y 13 están entregadas; los pedidos de las fases 14–18 requieren autorización propia.
Actualización: ABM en `/gestion/usuarios/`, marca institucional en `/gestion/colegio/`, cursos en `/gestion/cursos/` y biblioteca personal en el editor → Mis proyectos. Guardado manual y automático del proyecto vinculado en PostgreSQL con revisión optimista, importación/exportación y papelera recuperable. IndexedDB conserva documento y operación de Guardar antes de la red, con recuperación tras cierre y listado de otras copias de la cuenta. Al salir, elección explícita de conservar o retirar copias locales después de confirmar logout; no se limpian otras cuentas, archivos descargados ni equipos remotos. No es una cola general ni un respaldo. La continuidad local durante cortes exige un proyecto ya cargado y una sesión no vencida; al reconectar se revalidan acceso y conflictos. El historial y los borradores de escena se conservan por separado, sin publicarlos implícitamente. Arduino + ESP-IDF y la compilación/descarga privada con concurrencia configurable están implementados en DEV; USB/monitor también, con aceptación física pendiente. Producción no está activada y su Fase final queda postergada.

## 1. Decisiones acordadas

- Desplegar en una PC del propietario con Proxmox, sin dependencia de GitHub Pages, Render o Sites.
- Una fase completa por vez: trabajar, probar, informar y esperar OK antes de la siguiente fase. No detenerse para pedir aprobación entre subfases. Dar actualizaciones breves y hacer commit/push de los cambios versionables de cada entrega; no incluir secretos.
- Numeración actualizada por el propietario: 11 contexto portable para otra cuenta, 12 UX, 13 acceso externo a DEV, 14–18 backlog funcional y **Fase final** de producción sin número, postergada. El [plan detallado](PLAN_FASES_BACKLOG.md) define alcances y aceptación; planificar no equivale a autorizar implementación.
- Desactivar GitHub Pages desde ahora por indicación del propietario, conservando CI. No esperar al nuevo despliegue ni reactivar Pages automáticamente.
- Usar el gateway existente EXCLUSIVAMENTE como salto SSH. Está prohibido modificarlo, instalar, reiniciar o ejecutar comandos de administración allí; tampoco copiar claves privadas ni reenviar el agente SSH. Preparar sólo las VMs autorizadas.
- Dos VMs Ubuntu Server 24.04 LTS, desarrollo y producción, con los recursos que el propietario pueda asignar. Las configuraciones amplias sugeridas anteriormente no son requisitos mínimos ni compromisos de capacidad.
- Conservar el editor React/Blockly, las escenas, el simulador en Web Worker y la generación para Wemos D1 R32.
- Agregar Django y PostgreSQL para identidad, permisos y almacenamiento.
- Cuentas creadas exclusivamente por un administrador; no habrá registro público.
- Acceso por alias y contraseña. No se exige correo electrónico a los alumnos.
- Roles administrador, docente y alumno, con supervisión docente desde la primera versión multiusuario.
- Biblioteca de proyectos, guardado manual y automático e importación/exportación JSON.
- Conservar Arduino (`.ino`) y agregar proyecto ESP-IDF nativo; ambos son opciones, no una sustitución de Arduino.
- Compilar en el servidor con el destino elegido, descargar firmware y programar la Wemos por USB desde Chrome/Edge de escritorio.
- Flujo acordado: simular en la web → compilar → cargar → ejecución autónoma en la placa. No incluir control remoto ni seguimiento físico de bloques en vivo.
- Cantidad de compilaciones simultáneas configurable desde la cuenta administradora, inicialmente una y dentro de límites seguros para la VM.
- Nombre y logo del colegio visibles antes del login, administrables por el administrador; inicialmente un colegio por instalación.
- El propietario prepara las VMs y el acceso; el asistente instala las herramientas cuando estén disponibles y avisa después de instalar Git para que el propietario autentique el acceso.
- Un único «al comenzar», obligatorio y fuera de las categorías; concurrencia mediante «al mismo tiempo».
- Categoría «Favoritos» en la paleta de bloques, guardada por usuario.
- Avatares divertidos elegibles por el usuario: animales, robotitos, personajes y flores/plantas.
- Mensajes con dos destinos explícitos: consola/Serial y pantalla simulada con equivalente físico para Wemos.
- Ejecución pedagógica visible: cada paso identificable, estados comprensibles y modo guiado sin alterar el algoritmo.

El resto del documento fija valores iniciales propuestos. Los datos de infraestructura pendientes no impiden implementar y probar localmente, pero se deben confirmar antes del despliegue.

## 2. Alcance y límites

Un proyecto contiene el JSON portable existente: metadatos, destino Wemos, escena, workspace Blockly y configuración de simulación. El programa intermedio y las fuentes Arduino/ESP-IDF se regeneran; el estado transitorio de una simulación no se guarda como proyecto. Los binarios son artefactos derivados de una instantánea y un entorno de compilación identificados, no reemplazan al JSON editable.

Incluido: cuentas, ABM, cursos, asignación de docentes/alumnos, proyectos, supervisión de versiones guardadas, devoluciones, recuperación, favoritos, avatares, logo institucional, inicio único con concurrencia explícita, ejecución pedagógica visible, mensajes en consola/pantalla, exportaciones Arduino/ESP-IDF, compilación con cola y ajustes administrativos, descarga de firmware, grabación USB desde la web y despliegue reproducible.

Fuera de esta versión: edición simultánea colaborativa, vigilancia de pantalla o de pulsaciones, videollamadas, calificaciones, asistencia, rúbricas, gestión formal de tareas, galerías públicas, autoinscripción, control remoto de actuadores, depuración física paso a paso, seguimiento de bloques en la placa y carga por Wi-Fi/OTA. Tampoco habrá múltiples instituciones aisladas: inicialmente es una instalación administrada por su propietario. El compilador no acepta proyectos C/C++/CMake arbitrarios subidos por usuarios; compila fuentes generadas desde proyectos de bloques validados.

La conexión USB, compilación y grabación son parte del alcance acordado, detallado en la sección 12. El propietario ya preparó ambas VMs limitadas y autorizó comenzar por su preparación base. Esto no equivale a publicar producción ni a iniciar las funciones de otras fases.

## 3. Arquitectura y despliegue

```text
Navegador en la PC ── USB local ──> Wemos D1 R32
  └─ HTTPS: dominio dedicado, mismo origen para aplicación y API
      └─ VM Nginx existente (proxy inverso, entrada pública ya disponible)
          └─ Misma LAN del router y del host Proxmox
              ├─ VM desarrollo: código, pruebas y datos ficticios
              └─ VM producción: aplicación para alumnos

Cada VM, de forma independiente, con Docker Compose:
  ├─ Frontend React y Django
  ├─ PostgreSQL privado: identidad, proyectos y cola persistente
  └─ Planificador y ejecutores de compilación restringidos
      ├─ Arduino CLI + core ESP32
      └─ ESP-IDF nativo

Copias verificadas ──> destino fuera de la PC de Proxmox

Administración: PC remota ── SSH gateway sólo salto ──> VM destino
```

- Dos VMs Ubuntu Server 24.04 LTS sin escritorio, creadas por el propietario: VM 112 desarrollo, hostname `capi-dev`; VM 113 producción, hostname `capi-prd`. No instalar la aplicación en el host Proxmox. Docker Compose permite repetir el entorno. [Ubuntu Server](https://releases.ubuntu.com/releases/24.04/).
- Recursos comprobados: desarrollo 1 vCPU, producción 2 vCPU; ambas con aproximadamente 2 GB RAM, 2 GB swap y filesystem raíz de 31 GiB. Detalle en la fase 0. No aumentar asignaciones ni exigir las cifras amplias sugeridas previamente. Priorizar acceso/guardado frente a velocidad de compilación; comenzar con una compilación y paralelismo interno mínimo, sujeto a prueba de memoria real.
- Mantener la exportación estática del frontend existente; no rehacerlo en plantillas Django. El servidor Python atiende la API, no los pasos del simulador.
- Django 5.2 LTS con parches vigentes al implementar; PostgreSQL en una versión soportada, con versión mayor fijada. Versiones de imágenes y dependencias reproducibles, sin `latest` en producción.
- Servidores públicos estables; nunca `runserver`, `vinext dev` ni HMR expuestos a Internet. La fase 13 reutilizó la VM Nginx del propietario para el subdominio HTTPS de DEV. La Fase final, postergada y pendiente de autorización, prevé lo propio con configuración y secretos separados para producción. No instalar otro proxy público por defecto ni confundir la VM Nginx con el host Proxmox.
- Para CapiBloques sólo el proxy web queda accesible a clientes. No abrir nuevos accesos públicos a PostgreSQL, Docker o administración de Proxmox. El gateway ya accesible pertenece a infraestructura preexistente y no se modifica.
- HTTPS y cookies de sesión protegidas; frontend y API del mismo origen. Secretos fuera de Git y fuera del JavaScript público.
- Configuraciones, bases, volúmenes, secretos, colas, cachés y ejecutores separados entre desarrollo y producción. Producción no compila en desarrollo ni depende de que esa VM esté encendida. Datos ficticios en pruebas; no copiar trabajos infantiles a servicios externos de CI.
- Compilación inicialmente de un trabajo por vez y paralelismo interno acotado; el administrador podrá variar la simultaneidad según la sección 12. No se promete una capacidad ni tiempo de compilación sin medir la VM disponible. Si no alcanza la memoria o el disco, pausar admisión de nuevos trabajos y explicar el motivo; no sacrificar la base ni eliminar proyectos para continuar.
- Supuesto de prueba inicial: 30 alumnos y 2 docentes concurrentes. El tamaño de los proyectos y la frecuencia de guardado también forman parte de la carga.
- La compilación sí requiere una cola persistente y un planificador separado de las peticiones web. Reutilizar PostgreSQL para evitar un servicio adicional inicialmente; no son obligatorios Kubernetes, Redis ni WebSockets. El navegador consulta estados sin bloquear el editor. Las tareas de mantenimiento pueden ejecutarse con un temporizador del sistema dentro de cada VM.

Topología confirmada: Proxmox es el host físico; las VMs y la VM Nginx están en la misma LAN. DEV se publica por `https://capibloques.dev.nvicchi.com/`; sólo el edge puede alcanzar el origen LAN y el túnel loopback sigue disponible. El gateway continúa exclusivamente como salto TCP. Producción no está publicada por CapiBloques.

## 4. Identidad y permisos

### Cuentas

- Alias único dentro de la instalación, normalizado sin distinguir mayúsculas/minúsculas; nombre visible separado y avatar de catálogo.
- UUID de cuenta independiente del alias. Cambiar o reutilizar un alias no transfiere proyectos ni historial.
- Contraseñas almacenadas mediante el sistema de hash de Django, nunca recuperables por el administrador. Clave temporal al crear/restablecer, cambio requerido al ingresar.
- Límite de intentos, errores de acceso que no enumeren cuentas y registro mínimo de eventos. No registrar contraseñas ni cuerpos completos de proyectos.
- Sesiones de servidor revocables. Desactivar cuenta, cambiar privilegios o restablecer acceso invalida las autorizaciones anteriores según la operación.
- Sólo el administrador crea cuentas y restablece accesos. El docente no adquiere ese poder por tener un alumno en su curso: ese alumno podría pertenecer también a otro curso.
- ABM con búsqueda, filtros, modificación, desactivación/reactivación y eliminación definitiva. Antes de eliminar: mostrar cantidad de proyectos afectados, ofrecer respaldo y exigir confirmación explícita.
- No permitir borrar/desactivar/degradar al último administrador activo, comprobado dentro de una transacción.
- Primer administrador creado por un procedimiento local explícito, sin contraseña predeterminada en el repositorio. Recuperación operativa documentada para el propietario.
- Si se expone públicamente, incluir segundo factor para cuentas administrativas antes de habilitar producción.

Se propone permitir administrador + docente para la misma persona. Tener administración por sí sola no concede supervisión pedagógica; también requiere asignación docente al curso. El superusuario técnico de recuperación es una excepción operativa, no una cuenta cotidiana.

### Unidad de supervisión: curso

Un curso es el grupo de trabajo. Puede tener varios docentes y alumnos; una persona puede estar en varios cursos. El administrador crea/archiva cursos y administra sus membresías. No agregamos una segunda jerarquía de subgrupos en esta versión.

| Acción | Administrador | Docente | Alumno |
| --- | --- | --- | --- |
| Crear/modificar/desactivar cuentas y roles | Sí | No | No |
| Cambiar logo/nombre institucional y simultaneidad de compilaciones | Sí, límites de operación aplicados por servidor | No | No |
| Crear/archivar cursos y asignar miembros | Sí | No | No |
| Crear/editar/exportar proyectos propios | Sí | Sí | Sí |
| Compilar/descargar firmware/grabar copia propia en USB local | Sí, con cuotas | Sí, con cuotas | Sí, con cuotas |
| Ver la nómina de alumnos | Gestión global | Sólo sus cursos | No listado general |
| Leer/simular proyectos personales ajenos | No por administrar | No | No |
| Leer/simular/exportar proyectos de alumnos vinculados a un curso | Sólo con rol docente y asignación | Sólo en sus cursos autorizados | Sólo propios |
| Comentar una revisión de un alumno | Como docente asignado | En su ámbito | Responder en sus propios proyectos |
| Editar/borrar/restaurar el original ajeno | No en el flujo ordinario | No | No |
| Eliminar datos por baja definitiva de una cuenta | Sí, acción administrativa explícita y auditada | No | No |

Las restricciones se aplican en el servidor a listas, detalles, revisiones, comentarios y exportaciones. Conocer una URL/UUID o alterar el navegador no debe permitir saltarlas. Los roles no sustituyen los permisos por objeto: Django aporta la base, pero la autorización por curso y proyecto debe implementarse explícitamente. [Permisos por objeto en Django](https://docs.djangoproject.com/en/5.2/topics/auth/customizing/#handling-object-permissions).

## 5. Supervisión docente y experiencia

### Identidad del colegio antes del ingreso

- Mostrar logo y nombre del colegio en la pantalla de acceso antes de autenticar, junto a alias/contraseña. Inicialmente es un colegio por instalación; no intentar deducir la pertenencia de una persona aún anónima. Si más adelante se admiten varios colegios, será otro alcance con selección previa o dominio específico.
- Ajustes institucionales sólo para el administrador, con vista previa, Guardar/Cancelar y cambios auditados. La marca debe ser visible sin relegar el formulario fuera de la pantalla; texto alternativo, contraste, teclado y tamaño adaptable según las pautas de accesibilidad del proyecto.
- Logo suministrado por el propietario/colegio; no inventar una marca sustituta ni usar fotos de alumnos. Propuesta de carga inicial PNG/JPEG/WebP, con validación real de imagen, límite de bytes/dimensiones y recodificación segura; sin SVG/HTML arbitrarios ni descarga de URLs externas. Guardar el recurso en volumen persistente y respaldarlo.
- La respuesta pública expone únicamente nombre y logo aprobados, no usuarios, cursos, preferencias privadas ni configuración de compilación. Ante logo ausente o inválido, mantener nombre legible y formulario utilizable; error al reemplazarlo conserva el logo anterior.

Implementación 2B.2: un PNG optimizado de hasta 512 × 512 y 1 MiB se almacena con el nombre en PostgreSQL, dentro del volumen persistente existente. Es una decisión acotada para una sola imagen y recursos limitados: permite una escritura y un respaldo coherentes sin añadir almacenamiento de archivos separado. No extenderla automáticamente a adjuntos grandes. [Contrato, límites y pruebas](FASE_2B2_COLEGIO.md).

### Visibilidad

- Proyecto personal: sólo su propietario dentro de la aplicación.
- Proyecto de curso: propietario y docentes vigentes del curso, siempre que el alumno conserve su membresía.
- Cada proyecto pertenece a un propietario y, opcionalmente, a un curso. Crear desde un curso selecciona ese contexto de forma visible; desde «Mis proyectos» se propone personal.
- El editor muestra «Personal» o «Visible para docentes de [curso]». No se comparte toda la biblioteca de un alumno por inscribirlo en una clase.
- Vincular un proyecto personal a un curso requiere una acción explícita y autorización. No se puede vincular al curso de otro alumno.
- Para cambiar de curso un proyecto que ya tiene devoluciones, crear una copia sin comentarios, en lugar de trasladar el historial y exponerlo a otro grupo.
- Retirar una membresía revoca acceso docente en las siguientes peticiones; el cliente bloquea/limpia la vista cuando lo detecta. No se pueden recuperar retroactivamente datos ya descargados: exportar un JSON entrega una copia duradera y debe explicarse al docente.
- Archivar un curso impide nuevos vínculos y devoluciones. Se conserva lectura para miembros todavía autorizados; el alumno puede continuar mediante una copia personal. Retirar miembros sigue revocando acceso, también en cursos archivados.

### Panel docente

- «Mis cursos» → alumnos → proyectos visibles, nombre y fecha del último guardado en servidor.
- Actualización manual y refresco moderado mientras el panel está visible; nunca afirmar que refleja cambios aún locales o una pantalla en vivo.
- Abrir el editor en modo revisión: escena y bloques de sólo lectura, simulación interactiva y descarga JSON/fuentes Arduino/ESP-IDF de la revisión autorizada. Para compilar/grabar o experimentar con hardware, el docente crea su copia propia; no modifica el original ajeno.
- La revisión queda fijada mientras se inspecciona. Si el alumno guarda otra versión, mostrar «Hay una versión más reciente», sin reemplazar lo que el docente está comentando.
- Comentarios breves por proyecto y revisión inmutable; el alumno puede responder y marcar una devolución como atendida. Texto plano, sin adjuntos ni HTML libre.
- Conservar la revisión comentada para que una devolución no apunte a bloques diferentes tras un autoguardado. Si se agregan referencias a bloques más adelante, deben referirse al ID dentro de esa revisión.
- No hay «editar como alumno», borrado del original ni restauración forzada por el docente. Para experimentar, puede hacer una copia propia con procedencia visible, sin trasladar comentarios privados.

Esto ofrece supervisión de los proyectos de curso conforme se guardan, sin exigir un sistema de entregas/tareas y sin capturar actividad no guardada.

### Panel del alumno

- «Mis proyectos», «Mis cursos», devoluciones y papelera.
- Crear, abrir, renombrar, duplicar, guardar, importar/exportar, eliminar y restaurar proyectos propios.
- Botones y mensajes infantiles claros; conservar controles de guardar/cancelar/deshacer/rehacer, navegación por teclado y adaptación a Chrome/Edge y pantallas pequeñas.
- Indicador de quién puede ver el proyecto y de qué versión está guardada.

### Avatares de usuario

- Catálogo inicial con animales (incluido capibara), robotitos, personajes originales y flores/plantas, con estilo visual coherente y recursos propios o con licencia adecuada.
- Disponible para alumnos, docentes y administradores. Elegir al primer ingreso o más adelante desde el perfil; no bloquear el acceso al editor si se omite.
- Selector visual por categorías, vista previa y botones Guardar/Cancelar. Imágenes con nombres comprensibles, selección visible, navegación por teclado y tamaño cómodo en pantalla táctil, siguiendo las pautas de accesibilidad/diseño del proyecto.
- Propuesta inicial: sólo catálogo, sin subir fotos personales ni aceptar enlaces externos. Se conserva privacidad y no hace falta moderar archivos subidos por menores.
- Guardar un `avatarId` válido en la cuenta, no una imagen arbitraria. Debe persistir entre dispositivos y tener reemplazo seguro si un recurso se retira.
- Mostrar junto al alias en el perfil, proyectos y comentarios sólo a quienes ya tengan acceso a esas superficies. Cambiar avatar no cambia identidad, autoría ni permisos; distintos usuarios pueden elegir el mismo.
- Sin compras, sorteos ni desbloqueos obligatorios: todos los avatares del catálogo están disponibles.

### Favoritos en la paleta de bloques

- Primera categoría, siempre en el mismo lugar. Permite marcar/desmarcar con estrella tipos de bloque, por ejemplo Semáforo y Esperar, sin alterar las categorías originales.
- Los favoritos pertenecen al usuario y se conservan entre proyectos/dispositivos; no se mezclan con los del docente al revisar un proyecto ajeno.
- Orden estable, sin reorganización automática por frecuencia. Estado vacío con una explicación breve de cómo marcar un bloque.
- Favoritos de tipos de bloque, no copias de componentes de otra escena: los selectores siguen mostrando las instancias válidas del proyecto abierto. No arrastrar IDs o conexiones de otro proyecto.
- «Al comenzar» no es favorito porque ya existe y no se ofrece como bloque insertable. Entradas obsoletas o desconocidas no impiden abrir la cuenta y nunca afectan al programa.

### Un comienzo y tareas «al mismo tiempo»

- Todo proyecto tiene exactamente un bloque «al comenzar», creado automáticamente, no borrable/duplicable y ausente de la paleta. Vaciar el programa deja ese inicio vacío.
- Mantener la regla también al importar, pegar, cargar una versión y deshacer/rehacer, no sólo ocultando botones. Los bloques sueltos se conservan como borradores y se señalan como no ejecutables.
- «Al mismo tiempo» contiene ramas visuales con tareas concurrentes. Propuesta de semántica: al llegar al bloque se inician todas; las acciones posteriores continúan cuando terminan todas las ramas. Si una contiene un bucle infinito, se explica que no se alcanzará lo que está debajo del grupo.
- Las esperas de una rama no detienen las otras ni la interfaz. El simulador y ambos generadores (Arduino/ESP-IDF) deben compartir arranque, orden cooperativo, finalización y límites de tareas. Pausa/Paso/Detener de la web actúan sólo sobre la simulación, no son controles del firmware autónomo. Limitar cantidad/profundidad de tareas para no saturar el navegador o la placa.
- Migrar proyectos antiguos con varios inicios a un inicio único con ramas, conservando la concurrencia, IDs de acciones, referencias a componentes y orden de ejecución. No concatenar programas que antes corrían concurrentemente.
- Al importar un proyecto antiguo sin inicio, agregar uno vacío y conservar sus bloques sueltos, sin conectarlos automáticamente ni inventar ejecución.
- Actualizar ejemplos, validadores, generador, worker y pruebas. Si el cambio necesita otra versión del formato, migrar v1/v2 explícitamente; no prometer que las versiones antiguas de la aplicación podrán leer bloques nuevos.

### Ejecución visible y comprensible

- Diagnóstico del código actual: el worker puede ejecutar 32 instrucciones por quantum de 16 ms, pero la notificación global de actividad conserva sólo el último evento y se publica cada 40 ms. El borde ámbar actual y bajar la velocidad no bastan: muchos pasos rápidos no llegan a verse. Pausa, Paso y velocidad ya existen; hay que mejorar su semántica y presentación, no duplicar controles.
- Separar ejecución normal de «Ver paso a paso». En modo guiado, mostrar cada evento semántico con permanencia legible y avanzar manualmente o a un ritmo elegido. No insertar bloques Esperar ni cambiar el firmware para conseguir un efecto visual.
- Pausar conjuntamente el reloj lógico y todas las ramas entre pasos observados; conservar orden cooperativo, presupuesto y duraciones originales al continuar. Mostrar tiempo simulado separado del tiempo dedicado a observar. El reloj y los eventos de entrada deben permitir cotejar una ejecución guiada con una normal usando las mismas entradas lógicas.
- Destacado de alto contraste, flecha/etiqueta «Ahora» y explicación corta: «Semáforo norte: encendiendo rojo». Resaltar también el componente afectado. No depender únicamente del color, ni obligar a activar sonidos o animaciones.
- Enseñar decisiones, no sólo salidas: resultado verdadero/falso del condicional, repetición actual/total cuando exista, tiempo restante de espera y cambios de valores. Definir Paso como siguiente evento semántico, incluyendo evaluaciones de control.
- Con «al mismo tiempo», identificar cada rama por nombre/número y su estado ejecutando/esperando/finalizada. No fingir que sólo existe un bloque activo global ni acelerar una espera saltándose acciones pendientes de otra rama.
- Seguimiento automático opcional del bloque activo, sin quitarle al usuario el control del desplazamiento. Pausa conserva el contexto; Detener y finalizar distinguen el último paso del que sigue ejecutándose.
- Historial acotado de pasos recientes. En modo normal se permite resumir actividad rápida, indicándolo; en modo guiado no se descartan pasos. Aplicar contrapresión para que no crezca una cola visual infinita y mantener la interfaz disponible. Respetar movimiento reducido y navegación por teclado conforme a las pautas de diseño/accesibilidad del proyecto.

### Mensajes: consola y pantalla

- Estado actual verificado: `capi_serial` produce la operación `serial`, se muestra en la pestaña Consola del simulador y genera `Serial.println(...)` en Arduino. No controla un display físico ni muestra los mensajes automáticamente en una terminal del sistema operativo.
- Mantener ese destino con el nombre «escribir en consola [texto]», explicado como monitor Serial en la placa.
- Agregar un componente Pantalla a la escena y bloques «mostrar [texto] en [pantalla]» y «limpiar [pantalla]». El destino es una instancia concreta, no una salida global implícita.
- Comenzar con texto y números básicos; tamaños, líneas, saltos y caracteres soportados deben coincidir entre simulador y hardware. No simular emojis o tipografías que el módulo físico no pueda mostrar.
- Consola y pantalla no se reflejan automáticamente entre sí. Para escribir en ambos se usan ambos bloques, evitando suponer que un mensaje de depuración se verá en el dispositivo.
- Decisión del propietario para fase 7: **una sola pantalla por proyecto**. Perfiles LCD PCF8574 I2C 16×2/20×4, OLED SSD1306 I2C 128×64 y TFT SPI ILI9341/ILI9488. Texto directo en LCD o zonas de texto dentro de una gráfica. No incluir múltiples pantallas, buses compartidos, Waveshare ni la escena interactiva.
- Antes de generar firmware: documentar conexiones, dirección I2C o señales SPI, alimentación y niveles admitidos por el módulo. Las conexiones del controlador no pueden ocupar pines usados por otros componentes.
- Limitar frecuencia de refresco, tiempos de espera y cantidad de mensajes para mantener el comportamiento cooperativo. Un display ausente o que no responde no debe dejar al programa esperando indefinidamente.
- Fase 7 añade perfiles, bloques y conexiones al JSON, escenas, worker y generador Arduino, con compilación real en CI. En fase 8 se incorpora el equivalente nativo ESP-IDF: la biblioteca Arduino no se presume compatible ni justifica agregar Arduino como dependencia oculta. La compilación no sustituye probar el módulo físico antes del uso real.

## 6. Autoguardado sin pérdida de trabajo

1. Capturar cambios editables; no guardar cada tick de simulación, resaltado o actualización de sensores.
2. Guardar recuperación en IndexedDB, por usuario/proyecto, y enviar al servidor tras 1–2 segundos sin cambios, con un máximo inicial de 10 segundos durante edición continua. No guardar cada movimiento intermedio de un arrastre.
3. Mantener «Guardar» para sincronización inmediata. Sólo decir «Guardado en tu cuenta» después de confirmación del servidor.
4. Identificar cada operación y su revisión base. La actualización del contenido y el incremento de revisión deben ser atómicos. Reintentos idempotentes no duplican proyectos ni versiones.
5. Ante conflicto entre pestañas/dispositivos, conservar las dos versiones y ofrecer abrir la del servidor o crear una copia de la local. No fusionar automáticamente árboles Blockly.
6. Una respuesta vieja no puede marcar como guardado un cambio posterior. Cambiar de proyecto conserva su cola propia, sin enviarla al proyecto siguiente.
7. Sin conexión, permitir continuar sobre el proyecto cargado y exportar; reintentar al volver. Autenticarse sin servidor o abrir la aplicación desde cero offline quedan fuera de alcance inicial.
8. Guardar/Cancelar escena conserva sus niveles actuales: inspector → borrador de escena → proyecto confirmado. Una recuperación de borrador se almacena aparte y se ofrece explícitamente; cancelar la elimina, sin publicarla.
9. En equipos compartidos, no recordar sesión por defecto. Al salir, sincronizar o permitir exportar/descartar pendientes antes de limpiar caché. Tras cierre de sesión, expiración o cambio de cuenta, nunca mostrar ni reasignar pendientes de otro usuario.
10. La caché del navegador no es una barrera contra alguien con acceso físico al mismo perfil del sistema. El modo compartido minimiza persistencia; si se necesita aislamiento físico mayor, usar perfiles de sistema/navegador separados.

Estados visibles: guardando, guardado en tu cuenta, guardado sólo en esta computadora, sin conexión, sesión vencida y conflicto pendiente. No depender de que el navegador llegue a ejecutar código al cerrar una pestaña.

## 7. Formato, papelera e historial

- Mantener importación de los JSON v1/v2 existentes; versionar explícitamente cualquier evolución necesaria para «al mismo tiempo» y pantalla. No descartar tipos nuevos para aparentar compatibilidad. Identidad remota, roles, cursos, comentarios, favoritos y avatar no forman parte del archivo portable estándar.
- Importar siempre crea un proyecto independiente del usuario autenticado, personal por defecto. Para importarlo en un curso, elegir uno autorizado explícitamente.
- Validación cliente y servidor: tamaño, estructura, versión, profundidad, bloques permitidos, campos numéricos e identificadores. Reutilizar el contrato y casos de prueba del formato actual; no confiar sólo en TypeScript.
- Conservar los límites actuales de importación y definir cuotas de proyectos/historial por cuenta antes del piloto. No crecer sin límites ni borrar trabajo al alcanzar una cuota.
- Exportar JSON/fuentes refleja el contenido actual del editor, incluso si aún no fue sincronizado; no incluye secretos ni conversaciones. Arduino y ESP-IDF se regeneran y mantienen las verificaciones de cableado. Compilar crea una instantánea inmutable autorizada con hash y revisión identificable; el binario siempre corresponde a esa instantánea, nunca se presenta como una edición posterior.
- Conservar importación v1/v2 y el perfil Wemos existente. Separar conceptualmente placa de framework: `esp32:esp32:d1_uno32` identifica el destino Arduino, mientras ESP-IDF usa chip `esp32` y el mismo perfil explícito de placa/pines. Si se persiste selección de framework, migrarla sin romper archivos anteriores y mantener Arduino como selección de compatibilidad para ellos.
- Papelera protegida durante 30 días; restauración explícita. Después se habilita la purga individual confirmada, no un cron en DEV; sigue recuperable hasta que se purga. Una pestaña vieja o cola offline no puede resucitar un proyecto borrado.
- Historial recuperable: puntos de guardado manual y periódicos, con propuesta de hasta 20 versiones no referenciadas por proyecto. Conservar además revisiones ligadas a comentarios vigentes, sometidas a cuota de almacenamiento; no guardar indefinidamente una copia completa por cada autoguardado.
- La revisión actual siempre se conserva. Antes de descartar revisiones antiguas, aplicar una política explícita y proteger las comentadas.
- La eliminación definitiva del proyecto elimina su contenido, revisiones y comentarios operativos. Para eliminar una cuenta, mostrar y ejecutar una política explícita de borrado de sus proyectos y anonimización de sus intervenciones en proyectos ajenos.
- Los backups tienen su propio plazo de expiración: una baja no borra mágicamente copias históricas. Registrar eliminaciones para volver a aplicarlas si se restaura una copia anterior.

## 8. Modelo mínimo de datos

| Entidad | Datos y reglas principales |
| --- | --- |
| Usuario | UUID, alias normalizado único, nombre visible, roles, estado, hash de contraseña, cambio obligatorio, fechas. Basado en `AbstractUser` desde la primera migración. |
| Preferencias de usuario | Usuario único, `avatarId` del catálogo, tipos de bloques favoritos en orden estable y fecha de actualización. Edición sólo por su propietario, con validación de valores permitidos. |
| Configuración institucional | Una por instalación: nombre y recurso de logo público validado, versión, administrador y fecha. El archivo vive en volumen de medios persistente. |
| Configuración de compilación | Una por entorno: simultaneidad deseada, pausa de admisión, revisión, administrador y fecha. Techo operativo y límites de recursos controlados en despliegue, no valores arbitrarios aportados por el cliente. |
| Curso | UUID, nombre, descripción breve, activo/archivado, fechas. |
| Membresía | Curso, usuario, función docente/alumno, vigencia. Restricción de unicidad y coherencia con roles. |
| Proyecto | UUID, propietario, curso opcional, título, `ProjectFile` en JSONB, revisión creciente, fechas del servidor, estado de papelera. |
| Revisión | Proyecto, número de revisión, snapshot inmutable, autor/fecha y referencias de conservación. |
| Comentario | Proyecto, curso de contexto, revisión, autor, texto, respuesta opcional, estado de atención y fechas. |
| Evento de auditoría | Actor, operación, entidad afectada y fecha; sin contraseñas ni snapshots completos. |
| Operación de guardado | Identificador idempotente, usuario/proyecto, revisión base y resultado; conservación acotada. |
| Trabajo de compilación | Solicitante, proyecto e instantánea/hash, framework, perfil y versión de toolchain/generador, estado, intentos, lease/identificador de ejecución, tiempos y errores acotados. Reserva de cupo atómica y autorización por objeto. |
| Artefacto de firmware | Trabajo/instantánea, ruta interna opaca, hash, manifiesto de archivos/direcciones/perfil, tamaño y caducidad. Descarga autenticada; nunca confundir un artefacto cacheado con otro proyecto o versión. |

El servidor determina propietario, permisos y fechas. Ninguno de estos se confía al JSON importado. Los comentarios y revisiones conservan exactamente las mismas restricciones de acceso que el proyecto.

## 9. Copias, mantenimiento y continuidad

- Un volumen Docker persistente no reemplaza un backup; un snapshot en el mismo disco tampoco protege ante pérdida del equipo.
- Backup lógico diario consistente de PostgreSQL, medios institucionales, configuración de despliegue y secretos necesarios para recuperar, cifrado y enviado a un destino separado de esa PC. Separar entornos; las cachés y binarios temporales se regeneran, no exigen la retención de los proyectos.
- Backup de VM con las herramientas de Proxmox como complemento. Reutilizar el sistema de backup existente; no suponer que ya hay Proxmox Backup Server instalado.
- Retención inicial propuesta: 7 copias diarias y 4 semanales. Verificación automática de integridad y ensayo de restauración antes del piloto y periódicamente.
- Objetivos iniciales a aceptar: pérdida máxima de 24 horas ante desastre y recuperación en 4 horas, condicionadas a que haya hardware y copias disponibles. Si eso no alcanza, diseñar copias más frecuentes/PITR antes del uso real.
- Alertas mínimas: servicio caído, disco próximo a llenarse y backup fallido; definir destinatario y canal antes de producción.
- Actualizaciones controladas, imágenes versionadas, backup previo a migraciones y rollback documentado. Una migración de base no se revierte simplemente cambiando la imagen de la aplicación.
- La PC de Proxmox, la energía y la conectividad son puntos únicos de falla. Evaluar UPS; no prometer alta disponibilidad por usar una VM.
- Despliegue inicial manual y documentado. No exponer SSH/Proxmox ni agregar un runner privilegiado para conseguir despliegues automáticos.

El backup lógico de PostgreSQL está documentado como copia consistente mientras la base está en uso. [SQL dump de PostgreSQL](https://www.postgresql.org/docs/current/backup-dump.html). Proxmox Backup permite sincronización con servidores separados si esa infraestructura existe. [Remotos y sincronización](https://pbs.proxmox.com/docs/managing-remotes.html).

## 10. Etapas y criterios de aceptación

Numeración vigente: fases consecutivas 0–18, sin letras, más **Fase final** de producción, sin número y postergada. Las fases 0–9 y 11–13 están entregadas; fase 10 conserva aceptación física pendiente. Las fases 14–18 necesitan autorización de ejecución.

| Etapa | Entrega | Se considera terminada cuando… |
| --- | --- | --- |
| 0. Servidores y acceso de desarrollo | Inventario, herramientas base y pruebas de ambas VMs; retiro de Pages, CI, reglas de trabajo, autenticación GitHub por el propietario y checkout remoto | Se verifica acceso tras reinicio, Docker/Compose y Python. El repositorio se recupera sin copiar secretos y el editor se prueba desde esta PC por un canal restringido. Configuración, recuperación y cambios documentados, comprobados y enviados a Git; no exige activar producción. |
| 1. Base reproducible | Django, PostgreSQL, frontend existente y Docker Compose local | Levanta desde una instalación documentada, persiste al reiniciar y siguen pasando las pruebas del editor, worker y compilación Wemos. |
| 2. Cuentas, colegio y cursos | Logo previo al ingreso, acceso por alias, ABM, roles, cursos y membresías | El logo es público pero no los datos de alumnos; sólo admin cambia identidad institucional; no hay registro público ni autoascenso; se revocan sesiones; no se pierde el último administrador; se prueba aislamiento entre cursos. |
| 3. Biblioteca, proyectos de curso y bajas | Guardado manual en servidor, búsqueda, abrir/renombrar/duplicar, JSON, papelera recuperable, vínculo explícito a curso y baja de cuentas con conteo/respaldo/confirmación | Recuperación independiente del borrador local, permisos por propietario/curso, validación y conflictos sin sobrescritura. Retiradas/archivo de cursos y bajas no borran datos por cascada incidental; la supervisión visual se incorpora en fase 5. |
| 4. Guardado, recuperación e historial | Autoguardado durable, conflictos, continuidad local, salida compartida, escenas pendientes, versiones y papelera/purga | Probar cierre/reinicio, respuesta perdida, múltiples pestañas/cuentas, cuotas y fallos sin pérdida silenciosa; offline no autoriza red; Cancelar no publica escenas; restaurar crea revisión nueva; purga y bajas incluyen historial, plazos y confirmaciones. |
| 5. Supervisión · implementada en DEV | Panel docente, revisión de sólo lectura y devoluciones por versión; [cierre y pruebas](FASE_5_SUPERVISION_DOCENTE.md) | El docente sólo ve sus cursos; no modifica originales; sus comentarios mantienen contexto; perder membresía revoca acceso a todos los endpoints. |
| 6. Experiencia y programación · implementada en DEV | Avatares, favoritos, inicio único, «al mismo tiempo» y ejecución visible; [cierre y pruebas](FASE_6_EXPERIENCIA_Y_PROGRAMACION.md) | Las preferencias persisten por usuario; sólo hay un inicio en todas las rutas de edición/importación; la migración conserva concurrencia; cada paso guiado es legible y coincide con la traza lógica normal; pasa simulación/compilación Wemos. |
| 7. Mensajes y pantalla · implementada en DEV | Consola/Serial y una pantalla LCD/OLED/TFT con zonas de texto; [cierre y pruebas](FASE_7_MENSAJES_Y_PANTALLAS.md) | Se simula y genera el mismo texto, el perfil físico tiene conexiones validadas y compila; refresco acotado y timeouts sin esperas indefinidas. Pruebas físicas del módulo pendientes antes del uso con alumnos. |
| 8. Arduino y ESP-IDF · implementada en DEV | Exportación `.ino` conservada y ZIP ESP-IDF nativo, generadores desde el mismo programa intermedio; [cierre y pruebas](FASE_8_ARDUINO_Y_ESP_IDF.md) | Ambos compilan con herramientas fijadas, cubren bloques/componentes y conservan las reglas del simulador; IDF no depende de Arduino; los proyectos anteriores siguen abriendo/exportando. |
| 9. Compilación y descarga · implementada en DEV | Cola durable, ejecutores restringidos, firmware completo, Wi-Fi privado autorizado y ajuste de simultaneidad en admin; [alcance y pruebas](FASE_9_COMPILACION_Y_DESCARGA.md) | Se respetan límites globales y por usuario incluso con varios workers; cambios/reinicios no duplican trabajos; se descarga el firmware de la instantánea correcta; ni artefactos ni logs filtran datos de otros usuarios. |
| 10. USB desde la web · aceptación física pendiente | Monitor Serial y grabación en Chrome/Edge; [implementación y pruebas](FASE_10_USB_Y_SERIAL.md) | Se graban físicamente programas de ambos frameworks en Wemos, se verifican y ejecutan sin depender de la pestaña; errores y cortes tienen recuperación; detener la simulación no se presenta como detener hardware. |
| 11. Contexto portable · documentada, mantenimiento continuo | Documentación para continuar desde otra cuenta, punto de entrada y mensaje inicial | Desde un checkout limpio se reconstruyen estado, decisiones, reglas, pruebas y próximos pasos sin leer el chat; no se publican secretos ni datos infantiles. |
| 12. Editor despejado · entregada y verificada en DEV/CI | Encabezados compactos, catálogo separado, desplazamiento/zoom de escena, sesión sin interrupciones por foco y conexiones sobre imagen Wemos | Se recupera espacio útil, arrastrar/editar funciona en Chrome/Edge y cambiar de ventana no dispara validaciones por foco ni interrumpe el editor; se conservan permisos y trabajo. Navegar la escena no modifica coordenadas/JSON ni simulación; se puede recuperar la vista completa. Listado e imagen de conexiones concuerdan con el proyecto y el pinout documentado, conservando advertencias. |
| 13. Acceso externo a DEV · entregada y verificada | Subdominio HTTPS, runtime persistente, proxy Nginx y origen interno restringido; [cierre y evidencia](FASE_13_ACCESO_EXTERNO_DEV.md) | Acceso externo real en Chrome/Edge, servicio tras reinicio, certificado renovable, mismo origen y sin publicar HMR, base, Docker, compilador o administración; DNS creado por el propietario. |
| 14. Ejecución visual · planificada | Paralelo vertical, lienzo estático e indicadores de progreso en bloques/componentes | Varios hilos muestran avance propio sin mover scroll/zoom ni alterar tiempos lógicos, proyectos, autoguardado o historial. |
| 15. TX/RX serial · planificada | UART configurable, mensajes y bifurcación igual/distinto, integrados en la guía de conexiones | Simulación, Arduino e IDF coinciden ante mensajes completos, ausencia, timeout y fragmentos; espera no bloqueante, TX/RX visibles en listado/imagen y ensayo físico en Wemos. |
| 16. ESP32-S3 DevKit · planificada | Perfiles de placa, guía visual de conexiones DevKit y recorrido completo hasta USB | Modelo exacto, pines y memoria validados; ambas salidas compilan y se graban/ejecutan en la DevKit identificada; listado e imagen corresponden al perfil y Wemos conserva compatibilidad. |
| 17. Waveshare de 5 pulgadas · planificada | Perfil de placa, imagen con conexiones, pantalla y entrada táctil si existe | Modelo/revisión identificados, conectores disponibles/reservados correctamente señalados y mensajes/zonas funcionando físicamente con ambas herramientas, límites medidos y USB validado; no implica aún escena interactiva. |
| 18. Escena en pantalla · planificada | Representación gráfica y controles locales de dispositivos | Simulación y firmware concuerdan; prioridad manual/programa explícita, edición recuperable y ensayo físico en la pantalla identificada. |
| Final. Producción y piloto · postergada | Configuración de producción, HTTPS, backups, carga y reversión | Con autorización nueva y aceptación física de los destinos del piloto: restauración en entorno aislado, carga acordada, servicios internos protegidos y flujo con administrador, docentes y alumnos de prueba. |

Alcance, dependencias y aceptación completos en el [plan de fases pendientes](PLAN_FASES_BACKLOG.md).

La unidad de entrega y validación es la **fase completa**. Las fases 0–9 y 11–13 están entregadas; fase 10 conserva aceptación física pendiente; 14–18 requieren autorización propia y la Fase final está postergada.

Pruebas obligatorias adicionales:

- Dos docentes de cursos distintos y un alumno en ambos: sin filtración cruzada de proyectos, metadatos, revisiones ni comentarios.
- Docente que cambia IDs o llama a la API directamente: no puede editar, borrar, restaurar o reasignar proyectos ajenos.
- Cuenta desactivada con sesión abierta: ninguna operación remota nueva autorizada.
- Comentario sobre revisión N mientras el alumno guarda N+1: se mantiene el contexto N.
- Alumno que deja un curso: conserva su trabajo y el antiguo docente pierde autorización futura.
- Al borrar un proyecto, un autoguardado retrasado no lo vuelve a crear.
- Cambio de dominio desde Pages: exportación/importación conserva bloques, posiciones y conexiones.
- Avatares: elegir, cancelar, guardar y recuperar en otro navegador; avatar desconocido tiene reemplazo y no puede modificarse el perfil de otro usuario.
- Logo institucional: visible sin sesión, Guardar/Cancelar y recuperación tras reinicio; carga inválida no elimina el anterior; permisos de admin y respuesta pública mínima, sin usuarios/configuración privada.
- Favoritos: marcar/quitar, mantener orden entre proyectos y cuentas; un favorito no copia referencias a otra escena.
- Inicio único: nuevo proyecto, importación con cero/uno/varios inicios, pegar, borrar, duplicar y deshacer/rehacer; ninguna ruta deja un proyecto con múltiples inicios activos.
- Concurrencia explícita: ramas con distintas esperas, finalización, bucles, contadores compartidos y Stop; cotejar trazas del worker y la lógica del firmware antes/después de migrar.
- Ejecución visible: secuencia sin esperas, decisiones, bucles y ramas concurrentes; ningún evento semántico se pierde en modo guiado, los tiempos lógicos no cambian por la animación y no quedan resaltados que aparenten ejecución después de terminar. Verificar contraste, movimiento reducido y seguimiento opcional.
- Consola y pantalla: destinos independientes, limpiar pantalla, caracteres/límites de texto, errores I2C y JSON con referencias al display; compilar un fixture con el controlador elegido y validar físicamente el módulo antes del uso real.
- Generadores: exportar el mismo proyecto a Arduino y ESP-IDF nativo; compilar bloques, PWM, sensores, Wi-Fi, pantalla y concurrencia; probar el hardware y no aprobar equivalencia sólo por la compilación. La selección de framework no cambia la escena ni rompe v1/v2.
- Cola: varios workers, cupo global, duplicados, equidad, cola llena, pausa, timeout, OOM y reinicio con trabajos huérfanos; no hay procesos duplicados ni publicación de resultados de intentos vencidos. El editor y guardado siguen respondiendo con una ráfaga de pedidos.
- Admin: conservar la configuración tras reinicio, impedir cambios desde alumno/docente, validar 1 y 2 cuando el techo operativo lo permita, rechazar valores fuera de rango; reducir 2→1 no mata activos y no se inician más hasta quedar bajo el límite. Pruebas de scheduler sintéticas para escenarios que la VM no pueda ejecutar físicamente.
- Binarios/USB: snapshot N compilado mientras se edita N+1, caché separada por framework/configuración/usuario, autorización de logs/descarga; probar permiso denegado, puerto ocupado, placa equivocada, conexión interrumpida, liberación del monitor y recuperación de la carga.
- Chrome y Edge, teclado, móvil, arrastre y simulación durante solicitudes lentas de guardado.
- Prueba de carga con proyectos representativos y medición de latencia de guardado, tasa de errores y uso de memoria/disco; no aprobar capacidad sólo porque carga la pantalla de inicio.

El avance se informará por estas entregas verificadas, separando implementación, pruebas y despliegue. Este documento no compromete un tiempo de ejecución sin conocer el entorno y el resultado del primer hito.

## 11. Transición y datos pendientes

- GitHub Pages fue retirado por indicación del propietario; conservar el código y CI sin despliegue automático. No modificar otros dominios ni publicar una versión incompleta en otro servicio.
- Los proyectos locales pertenecen al origen del navegador: la nueva web no puede leer automáticamente el almacenamiento de Pages. Ofrecer instrucciones de exportar/importar; nunca apropiarse del proyecto local de una PC compartida.
- No borrar almacenamiento del navegador al retirar Pages. Si quedan proyectos sin exportar en ese origen, coordinar su recuperación con el propietario; no prometer migración automática ni reactivar el sitio sin autorización.
- En el repositorio, agregar backend, configuración Docker y pruebas sin mezclar autenticación con el generador o el worker. Separar servicios de almacenamiento/sincronización del componente principal React.
- En fase 0 se reemplazó publicación Pages por CI sin despliegue. Los scripts y metadatos heredados que no publican nada por sí mismos no autorizan reactivar Pages ni cambiar de alojamiento; la operación pública vigente corresponde a la fase 13.

Estado de las confirmaciones y pendientes para próximos despliegues:

1. Recursos realmente asignados a ambas VMs, hardware libre del host, versión de Proxmox y servicios existentes que se deban respetar. No hay obligación de alcanzar las cifras orientativas descartadas.
2. Los accesos de ambas VMs por gateway ya se probaron y permanecen fuera de Git. En fase 13 se confirmaron FQDN, DNS/certificado y la VM Nginx exacta; el propietario creó el registro en GoDaddy sin compartir credenciales. La [guía de fase 13](FASE_13_ACCESO_EXTERNO_DEV.md) conserva la evidencia y la operación de DEV. Los futuros cambios requieren verificar otra vez su destino y alcance autorizado. Autenticación GitHub realizada por el propietario tras aviso, sin enviar secretos al chat.
3. Número real de alumnos/docentes simultáneos y volumen esperado de proyectos.
4. Destino de backup fuera de la PC y canal para recibir alertas.
5. Responsable operativo y aceptación de retención, alcance de supervisión y objetivos de recuperación.
6. Módulo de pantalla disponible (controlador, resolución, interfaz y alimentación), antes de cerrar su perfil de hardware.
7. Logo y nombre institucional suministrados por el propietario; techo de compilación seguro según medición de las VMs y margen del host compartido.

DEV ya está publicado conforme a la fase 13. No se abren puertos del router, se copian datos reales ni se modifica el host/gateway. Los pasos de despliegue posteriores se coordinan por fase; las fases 14–18 requieren autorización propia y producción continúa postergada.

### Antecedente de fase 0: preparación de ambas VMs y trabajo en desarrollo

Los pasos siguientes conservan la secuencia acordada al iniciar el proyecto; no son trabajo pendiente ni autorización para repetir la preparación. El estado y la evidencia de esa entrega están en [fase 0](FASE_0_SERVIDORES.md); la operación actual de DEV está en [fase 13](FASE_13_ACCESO_EXTERNO_DEV.md).

- El propietario prepara dos VMs Ubuntu Server 24.04 LTS, sin escritorio, con la CPU/RAM/disco que pueda asignar. Dejar sistema actualizado, OpenSSH, usuario con sudo y acceso por clave, IP estable/reservada y conectividad. Empezar por desarrollo; producción puede permanecer sin servicios mientras se construye la aplicación. No instalar dependencias de la aplicación en el host del hipervisor.
- Mantener Git como fuente del código; trasladar explícitamente el trabajo local pendiente, incluido este plan, sin sobrescribir cambios. SSH con clave y usuario no root para trabajo habitual; privilegios administrativos sólo para preparar lo necesario. No pedir contraseñas privadas en el chat.
- Instalar herramientas en etapas: base Git/GitHub CLI, Docker Compose y Python en fase 0; Node y dependencias de desarrollo en el entorno reproducible aprobado; Arduino CLI/core ESP32 y ESP-IDF en la fase de compilación, con versiones fijadas. No cargar de entrada las VMs pequeñas con ambos toolchains completos; no hace falta Arduino IDE ni escritorio gráfico.
- Tras instalar Git, avisar expresamente al propietario y esperar a que autentique el acceso al repositorio mediante el mecanismo elegido. Git y la autenticación a GitHub son cosas distintas. No crear una cuenta propia del asistente ni copiar tokens/claves de desarrollo a producción. Si luego se necesita una identidad técnica, debe crearla/controlarla el propietario con permisos mínimos; no es requisito para comenzar.
- Usar la VM para backend, base y herramientas de desarrollo, con datos ficticios y configuración separada de producción. Hasta fase 13 el acceso se mantuvo restringido por LAN/túnel. La fase 13 publicó un runtime estático detrás de HTTPS, con el login propio de CapiBloques como barrera elegida y el origen limitado a la VM Nginx; nunca el servidor con HMR ni los servicios internos directamente a Internet. El túnel loopback se conserva para recuperación.
- El navegador sigue en la PC del usuario y conecta su USB local. No hace falta passthrough USB a Proxmox ni conectar las placas de los alumnos al servidor.
- Para probar Web Serial desde un dominio/IP de la VM, servir HTTPS confiable para esa PC; alternativamente, acceder al desarrollo mediante un túnel SSH a localhost. HTTP sobre una IP de LAN no hereda la excepción de localhost.
- Verificar arranque y herramientas base, luego cerrar 0A y esperar autenticación/OK antes de checkout y acceso al editor en 0B. La aplicación actual se conserva en Git pero Pages se retira por orden del propietario. No convertir desarrollo automáticamente en producción ni avanzar de fase sin aprobación. Registrar las mutaciones y pruebas realizadas en `FASE_0_SERVIDORES.md`.

## 12. Arduino, ESP-IDF, compilación y carga USB

Estado: las dos salidas de fuentes están implementadas y compiladas en la fase 8. La fase 9 incorpora compilación en servidor y descarga de firmware completo. USB desde la web está implementado en la fase 10; su aceptación física sigue pendiente y no se validó en placa. El recorrido es simular comportamiento en la web, elegir salida, compilar, descargar o grabar y ejecutar autónomamente. Se conservan Arduino y exportación JSON; no se necesita controlar la placa en vivo.

### A. Dos generadores y salidas portables

- Opciones visibles: «Descargar proyecto JSON», «Descargar Arduino (.ino)», «Descargar proyecto ESP-IDF (.zip)», «Descargar firmware» y «Programar mi Wemos». Las dos últimas usan el framework seleccionado y muestran versión del proyecto/placa; no exigir descargar archivos intermedios al usar la grabación directa.
- Mantener el generador Arduino y su destino actual `esp32:esp32:d1_uno32`. No retirar Arduino, relegarlo a archivos antiguos ni obligar al alumno a instalar el IDE cuando use el servidor y la web.
- Agregar un generador ESP-IDF nativo para chip `esp32` y perfil Wemos D1 R32. Entregar ZIP reproducible con C/C++, `CMakeLists.txt`, configuración y dependencias/versiones documentadas. No basta renombrar `.ino` ni envolver `Arduino.h` como componente de IDF. [Sistema de proyectos ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/build-system.html).
- Ambos parten del mismo programa intermedio validado y perfil de componentes. Adaptar GPIO, ADC, PWM/LEDC, servos, buzzer, Wi-Fi, consola y pantalla a cada framework. Preservar temporización lógica, límites de contadores y orden cooperativo; no convertir automáticamente cada rama en una tarea libre de FreeRTOS que introduzca carreras distintas del simulador.
- Identificar cada compilación por instantánea/hash, framework, versión de generador, toolchain, librerías, configuración y perfil de placa. Fijar versiones soportadas al implementar; no usar `latest` para builds reproducibles.
- Entregar firmware completo apropiado para la placa y un manifiesto con componentes, direcciones de grabación y hashes. Puede ofrecerse imagen combinada más instrucciones, sin confundir el binario de aplicación con una imagen completa para placa recién preparada. ESP-IDF permite combinar bootloader, particiones y aplicación. [Generación de binario combinado](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/tools/idf-py.html#merge-binaries-merge-bin).

### B. USB y monitor Serial integrado

- Opción acordada: Web Serial en Chrome/Edge de escritorio, detectando soporte y permisos; no prometer el mismo flujo en todos los navegadores o móviles. Espressif mantiene un flasheador web basado en esta API. [esptool-js](https://github.com/espressif/esptool-js).
- Placa conectada a la PC que abre el navegador, cable USB de datos y conversor USB-serie reconocido por el sistema. Verificar el chip de la unidad real y usar su driver oficial si falta; no asumir que todos los clones montan el mismo conversor. Cerrar otros monitores que ocupen el puerto. [Conexión serie de ESP32](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/establish-serial-connection.html).
- HTTPS confiable y acción explícita «Conectar placa» para abrir el selector de dispositivo. Localhost permite desarrollo local; una dirección HTTP de otra PC en la LAN no equivale a localhost. [Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Serial), [contextos seguros](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).
- Monitor de mensajes reales a 115200 baudios, claramente separado de la consola simulada. Lectura asíncrona, buffers acotados, tratamiento de mensajes fragmentados y errores/desconexiones. No requiere un agente local ni que Proxmox tenga acceso a USB en navegadores compatibles. [API asíncrona y permisos](https://developer.chrome.com/docs/capabilities/serial).
- Monitor destinado a leer mensajes reales; no agrega órdenes de control de actuadores ni seguimiento de bloques. Mostrar puerto/estado y separar consola simulada de Serial real. La identidad de placa detectada al grabar no demuestra por sí sola que un firmware anterior sea CapiBloques.

### C. Compilar y cargar para ejecución autónoma

- Flujo acordado: instantánea validada → fuentes Arduino o ESP-IDF → cola y compilación aislada en el servidor → binarios y manifiesto → descarga o navegador → USB de la PC → Wemos. Las fuentes no se envían como ejecutables. Arduino CLI e `idf.py` son herramientas de compilación; esptool-js graba los binarios. [Arduino CLI](https://docs.arduino.cc/arduino-cli/), [ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/tools/idf-py.html), [esptool-js](https://github.com/espressif/esptool-js).
- No copiar direcciones de flash de un ejemplo genérico ni cargar un binario de otro proyecto/revisión. Si el editor cambió mientras compilaba, explicar que el artefacto corresponde a la instantánea anterior y ofrecer recompilar; nunca grabarlo como si fuera el último contenido.
- Compilador separado del proceso Django/PostgreSQL, en ejecutores restringidos del mismo entorno, sin credenciales de base, volúmenes de proyectos/medios, privilegios ni socket Docker. El planificador confiable administra la cola y entrega sólo el input validado a cada ejecución; el compilador no necesita acceso directo a la base. Limitar CPU, RAM, tiempo, disco, procesos y salida de logs. Preparar toolchains/dependencias permitidas previamente; no instalar paquetes ni ejecutar comandos/flags/CMake suministrados por el cliente.
- Inicialmente no hace falta una tercera VM: cada entorno tiene su servicio de compilación restringido y su propia cola. Esto comparte recursos y kernel con la aplicación de ese entorno; si las mediciones o un futuro alcance de código arbitrario exigen otro aislamiento, evaluar infraestructura adicional con el propietario, sin asumir recursos inexistentes.
- Mantener autorización por proyecto también en trabajos, logs y descargas; artefactos temporales privados y caducables. No bloquear peticiones del servidor mientras compila.
- Revisar cableado, identificar la placa elegida y confirmar reemplazo del firmware. La carga reinicia la placa; puede requerir ayuda con el modo de arranque según la unidad. No borrar toda la flash por defecto. Si la grabación se interrumpe, ofrecer recuperación sin afirmar que el firmware anterior permanece utilizable.
- La consola debe liberar el puerto antes de grabar y recuperarlo después. Mostrar fases reales preparando/compilando/grabando/verificando, sin porcentajes inventados ni prometer cancelación reversible una vez iniciada la escritura.
- Una vez cargado, el programa corre sin la pestaña y con alimentación adecuada. Cerrar la web o su simulador no detiene ese firmware autónomo. Para pruebas con motores, contemplar parada física y salidas seguras; no presentar un botón web como paro de emergencia garantizado.
- Credenciales Wi-Fi: el propietario eligió resolverlas en fase 9 y **autorizó enviarlas al servidor para una compilación privada y temporal**. El diálogo pide consentimiento, el servidor cifra las pendientes y retira los inputs al entregarlos al ejecutor; cancelación/caducidad también los retira. No entran en JSON, historial, logs ni cachés compartidas. Los binarios con Wi-Fi no se reutilizan, son privados y vencen a las 24 horas; contienen la clave y no deben compartirse. Retirar no borra descargas previas, snapshots/backups, swap o residuos de flash. Las fuentes exportadas conservan marcadores para configuración local. La fase 9 se entregó sin requerir provisión por USB. La grabación USB y el monitor están implementados en fase 10; su aceptación física sigue pendiente. Ver [tratamiento y límites](FASE_9_COMPILACION_Y_DESCARGA.md#wi-fi-y-privacidad).

### D. Cola y ajuste de simultaneidad desde administración

- «Administración → Compilaciones»: cantidad máxima simultánea configurable, inicialmente 1 por entorno. Persistir el valor y auditar quién lo cambió, cuándo y valor anterior/nuevo. Validar permisos, entero positivo y rango también en el servidor.
- Establecer un techo operativo por despliegue según recursos reales; el administrador puede ensayar valores dentro de ese techo, pero no quitar límites de CPU/RAM/disco ni otorgar privilegios al ejecutor. Mostrar valor configurado, techo, activas, pendientes, fallos y duración/espera medidas. No presentar el techo como garantía de rendimiento.
- Interfaz clara con Guardar/Cancelar, explicación del efecto y errores junto al campo; accesible por teclado, sin depender del color. Cambios concurrentes de configuración usan revisión para evitar sobreescrituras silenciosas. Aplicar cambios a nuevos arranques sin requerir reiniciar toda la aplicación.
- Bajar el límite no interrumpe trabajos activos: se espera a quedar por debajo antes de admitir otro arranque. Subirlo habilita cupos adicionales sólo cuando existen ejecutores y recursos. Un control separado de pausa permite detener nuevos ingresos/arranques para mantenimiento conservando la cola existente y dejando terminar los activos; no usar cero con significado ambiguo.
- El cupo es global por entorno y compartido entre builds Arduino/ESP-IDF, no un cupo por framework o por worker. Reservar cupo y trabajo atómicamente; un bloqueo de filas de trabajos por sí solo no asegura el límite global. Dos workers no pueden duplicar un trabajo ni exceder la configuración.
- Acotar también procesos internos por compilación: una sola compilación puede usar varios núcleos. CPU/RAM/disco y número de workers se ajustan a las VMs limitadas, considerando que desarrollo y producción comparten host físico. Priorizar memoria para aplicación/base y evitar compilaciones pesadas simultáneas en ambos entornos durante pruebas si el host no alcanza. [Paralelismo ESP-IDF](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/build-system.html).
- Cola durable y acotada con cuotas por usuario. Propuesta inicial: máximo una activa por usuario y turno rotativo entre usuarios, FIFO dentro de cada usuario. Deduplicar solicitudes idénticas/idempotentes; no encolar en cada autoguardado. Cola llena devuelve explicación sin perder el proyecto ni congelar edición/simulación.
- Trabajos con estados en cola, compilando, listo, fallido, cancelado y caducado; errores comprensibles y detalles técnicos acotados. Cerrar la pestaña no duplica ni cancela por sí solo una compilación remota. El usuario puede cancelar su pedido en cola; un pedido nuevo no borra artefactos previos válidos.
- Reclamos con lease, heartbeat e intento identificado. Tras caída/reinicio, comprobar o terminar la ejecución anterior antes de liberar su cupo y relanzar: no confiar sólo en que venció un temporizador. Publicar resultados sólo del intento vigente, reintentar fallas transitorias con límite y no repetir automáticamente errores deterministas/OOM en un bucle.
- Reutilizar toolchains y caché de dependencias; clave de resultado incluye fuentes, framework, generador, versión de herramientas, librerías, perfil y configuración. Resultados privados por cuenta/proyecto por defecto; un hash no concede permiso. No compartir fuentes, logs o binarios entre usuarios a través de una caché, ni cachear credenciales. Acotar disco y caducidad con limpieza sólo de temporales/artefactos, nunca de proyectos.
- Medir compilaciones en frío/caliente y ráfagas de pedidos: espera, duración, CPU/RAM/disco y latencia de guardado. Informar tiempos observados, no porcentajes o capacidad inventados. Con pocos recursos es aceptable esperar más; la respuesta prevista es cola y límites, no lanzar todos los pedidos a la vez.

### E. Límites explícitos del hardware autónomo

- No se implementan órdenes remotas para mover motores, lectura sincronizada de sensores hacia la escena, pausas/pasos físicos ni resaltado de bloques reales. El simulador no se presenta como espejo de una placa conectada.
- Una vez grabada, la Wemos ejecuta el algoritmo con sus sensores/actuadores reales y alimentación adecuada. La web sólo realiza carga y lectura opcional de mensajes Serial; cerrar la consola o pulsar Detener simulación no detiene la placa. No hace falta firmware puente de control en vivo.
- La carga Wi-Fi/OTA y el control por red quedan fuera; el bloque Wi-Fi del proyecto sigue siendo una función del programa autónomo, no un canal de control para la web.

Secuencia acordada: preservar Arduino → agregar ESP-IDF → compilación con cola/configuración admin → descarga y grabación USB → prueba autónoma física. El software hasta USB y monitor está implementado; queda pendiente la aceptación física de fase 10. No agregar una fase de control en vivo sin un nuevo pedido del usuario.
