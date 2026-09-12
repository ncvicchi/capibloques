# Fase 13 — Acceso externo persistente a DEV

Estado: **entregada y verificada en DEV el 12 de septiembre de 2026**. Versión funcional desplegada: `1ee0df9`.

## Entrega verificada

- URL: `https://capibloques.dev.nvicchi.com/`; HTTP redirige a HTTPS y frontend/API comparten origen.
- `editor` es un build estático servido por Nginx no-root, sin Node, Vinext ni HMR en ejecución. Conserva `127.0.0.1:3000` para recuperación por túnel y publica `192.168.1.77:3080` únicamente hacia el edge `192.168.1.38`.
- Django acepta sólo el host/origen HTTPS declarado, usa cookies seguras y confía cabeceras de proxy únicamente desde las IP exactas configuradas. El proxy limpia cabeceras elegidas por el cliente y el límite de intentos de login usa la IP validada.
- `capibloques-dev-firewall.service` y `capibloques-dev-web.service` quedaron habilitados. Tras reiniciar `capi-dev`, firewall, web, API, PostgreSQL y compilador recuperaron estado saludable automáticamente.
- Certificado Let's Encrypt válido hasta el 11 de diciembre de 2026; renovación aislada en modo ensayo correcta. El sitio fue instalado en el listener HTTPS interno `8443` de la VM Nginx compartida, sin modificar el gateway, Proxmox, router ni PRD.
- Se eligió deliberadamente **el login propio de CapiBloques sin una segunda Basic Auth**. DEV mantiene cuentas/datos sintéticos, limitación de intentos en Django, origen cerrado al edge y allowlists exactas. `render_edge.py` conserva Basic Auth opcional para activarla luego sin versionar hashes.
- Evidencia: 197 pruebas backend en PostgreSQL, 8 contratos del runtime, build de 10 páginas, raíz/API local y pública HTTP 200, 18/18 smoke externos Chrome/Edge, rechazo directo desde PRD (`000`) y prueba negativa de que el dominio de producción no sirve CapiBloques.
- Commits funcionales: `f1944f3`, `c49f13f` y `1ee0df9`. Se creó respaldo PostgreSQL previo y respaldos privados reversibles de cada cambio de runtime/Nginx.

Operación canónica en DEV: `sudo capibloques-dev-runtime status`, `validate`, `deploy`/`deploy --with-api` y `rollback <tag>`. No usar `docker compose up editor` directamente: systemd supervisa el runtime y el firewall debe estar activo antes del listener LAN. Alcance y precondiciones en [operación vigente](#operación-vigente).

## Operación vigente

Procedimiento contrastado con [runtime.py](../ops/public-dev/runtime.py), [install.py](../ops/public-dev/install.py), [Compose del editor](../compose.dev.yaml) y [verificación backend](../scripts/verify-backend-dev.sh) durante la corrección documental del 12 de septiembre de 2026. Esta revisión local no agrega pruebas remotas a la evidencia de entrega anterior. Esta sección sustituye las recetas de despliegue de las guías históricas de fases 0–12; sus contratos funcionales y resultados fechados se conservan.

### Consultar estado

Después de autenticar, comprobar identidad antes de operar:

```sh
test "$(hostname)" = capi-dev || exit 1
cd /home/capi/capibloques
git status --short --branch
git rev-parse HEAD
sudo capibloques-dev-runtime status
sudo capibloques-dev-runtime validate
systemctl is-active capibloques-compiler
curl --fail --max-time 12 http://127.0.0.1:3000/api/health/ready/
```

El runtime exige root en `capi-dev` y toma el checkout de su configuración privada. `status` muestra web, contenedores y firewall; hay que leer sus estados, no asumir que el retorno del comando certifica todos los servicios. `validate` comprueba Compose y reglas del firewall, con la configuración de confianza de API marcada vigente. Ninguno verifica por sí solo DNS, certificado, cookies ni acceso externo. No imprimir archivos de configuración privada, secretos ni logs de proyectos.

### Actualizar frontend

1. Confirmar identidad, árbol limpio, commit objetivo y alcance del diff. Si sólo cambian documentos, publicar en Git sin desplegar. Si cambia backend, dependencias, migraciones, Compose o compilador, preparar además el mantenimiento específico descrito debajo.
2. Desde Administración → Compilaciones, pausar admisión/arranques; dejar terminar los trabajos y comprobar que no queden intentos activos. Detener entonces `capibloques-compiler.service`. No liberar cupos ni matar trabajos para forzar la actualización.
3. Con el checkout limpio y el planificador detenido, actualizar mediante `git pull --ff-only origin main` al commit verificado. Para código backend montado desde el checkout, preparar previamente su ventana de mantenimiento; no tratar ese pull como una actualización exclusivamente visual.
4. Ejecutar `sudo capibloques-dev-runtime deploy`. El runtime comprueba que el planificador esté detenido y no haya contenedores compiladores en ejecución; detiene web/editor, construye la imagen estática versionada y arranca mediante systemd, esperando salud. Node y `npm ci` pertenecen a la etapa de construcción; el contenedor `editor` final no contiene Node/HMR. No arrancarlo manualmente con Compose.
5. Comprobar commit/imagen, `status`, `validate`, salud por túnel y HTTPS público, y el recorrido afectado. Después iniciar `capibloques-compiler.service`, verificar su estado y restituir la admisión acordada. El runtime **no pausa la cola ni reinicia el planificador ni quita la pausa automáticamente**. Si el mantenimiento falla, conservar la pausa y registrar el estado pendiente.

La compilación normal de proyectos sí funciona con editor/API activos; la exclusión anterior corresponde al build y mantenimiento del runtime en esta VM limitada, con techo de compilación 1.

### Backend, configuración y pruebas

- El runtime utiliza la configuración privada junto con los tres archivos Compose: editor, backend y compilador. El tercero conserva el montaje privado de firmware. Toda operación adicional de build, migración o recreación debe preservar esa combinación y el entorno vigente; no copiar una receta antigua con valores por defecto.
- `deploy --with-api` recrea API con la configuración privada y espera salud. Es obligatorio si el instalador marcó un cambio en hosts/proxies/cookies. **No construye la imagen API ni ejecuta migraciones.** Si cambian dependencias o esquema, preparar respaldo privado, construcción y migración según el diff, antes de habilitar el servicio. No presentar esos pasos como ejecutados por este comando.
- El código Python está montado desde el checkout. Un pull puede modificar archivos utilizados por API aunque la imagen frontend no cambie; evaluar la parada/recreación necesaria antes de actualizar. No recrear API/base ni cambiar receta del compilador con intentos activos.
- El [instalador público](../ops/public-dev/install.py) copia runtime, firewall y unidades al sistema; actualizar Git por sí solo no actualiza esas copias instaladas. Revisar su instalación respaldada si cambian esos archivos o la configuración de red. No reinstalarlo como efecto de un cambio de documentación o frontend. Ninguno de estos comandos modifica la VM Nginx; cualquier cambio allí necesita el alcance correspondiente.
- `sudo sh scripts/verify-backend-dev.sh`, **sin `--restart`**, usa API/DB existentes y migradas, ejecuta comprobaciones y pruebas en `test_capibloques`, y crea esa base de pruebas si falta. Django prepara el esquema de pruebas; el script no migra la base principal `capibloques` ni trabaja sobre proyectos reales como fixtures.
- El script de pruebas no carga la configuración privada pública. **No ejecutar su opción `--restart` tal cual en DEV:** recrea API/DB y podría aplicar hosts, CSRF, proxies y cookies por defecto. Se conserva en CI aislado; un ensayo equivalente en DEV requiere adaptar y verificar la operación con el entorno público, además de pausar y esperar los trabajos. Esta corrección documental no modifica el script.

### Límites de reversión

`sudo capibloques-dev-runtime rollback <tag>` requiere una imagen frontend local con revisión Git válida. Restaura esa imagen y espera salud; **no revierte checkout, backend, migraciones ni datos**. Antes de usarlo, comprobar compatibilidad con API y esquema actuales.

Ante un fallo de deploy, el runtime intenta recuperar la configuración/imagen frontend anterior; una API ya recreada no se revierte por ese mecanismo. Si la imagen anterior falta o tampoco queda saludable, el listener se deshabilita. Consultar estado y preparar la recuperación correspondiente, sin regenerar secretos, borrar volúmenes o restaurar sobre la base real como prueba. La [reversión de publicación](#reversión) tiene otro alcance y exige coordinar los cambios del edge/DNS.

## Resultado esperado

Una URL HTTPS dedicada permite entrar a CapiBloques DEV desde fuera de la LAN. La URL continúa funcionando después de cerrar la PC de trabajo y después de reiniciar `capi-dev`; la aplicación y la API comparten origen y no dependen de un túnel SSH para el uso normal.

Esto publica un **entorno de desarrollo controlado**, no producción. DEV utiliza datos ficticios, puede cambiar durante pruebas y no recibe cursos o trabajos reales. La Fase final conserva el despliegue para alumnos, backups externos, carga, monitoreo operativo y piloto.

## Topología objetivo

```text
Chrome/Edge externo
  └─ HTTPS 443 · dominio DEV dedicado
      └─ VM Nginx existente en la infraestructura Proxmox
          └─ origen interno permitido sólo desde esa VM
              └─ capi-dev
                  ├─ frontend + proxy de API, servicio persistente
                  ├─ Django privado
                  ├─ PostgreSQL privado
                  └─ planificador/compilador privados

PC de administración
  └─ túnel SSH a localhost · recuperación y mantenimiento
```

La «VM Nginx» no es el gateway y no es el host Proxmox. Si el inventario no permite distinguirlos sin duda, no se modifica nada hasta que el propietario identifique el destino. La prohibición de ejecutar comandos o cambiar configuración en el gateway continúa sin excepciones.

## Responsabilidades

### Propietario

- Elegir el FQDN de DEV.
- Crear en GoDaddy el registro A o CNAME que se le indique una vez verificado el destino público.
- Conservar sus credenciales de GoDaddy; no compartirlas por chat ni guardarlas en Git.
- Confirmar el acceso administrativo a la VM Nginx exacta y coordinar cualquier reinicio de infraestructura compartida.

### Implementación de la fase

- Auditar de sólo lectura la VM Nginx, sus sitios, red, certificado y mecanismo de renovación; guardar una copia privada y fechada sólo de la configuración que vaya a cambiar.
- Entregar una configuración dedicada y reversible para el dominio DEV, validarla con `nginx -t` y recargar sin cortar otros sitios.
- Crear un runtime público de DEV reproducible y separado de `vinext dev`/HMR. Ejecutarlo como servicio persistente con política de reinicio, healthcheck, límites y rotación de logs.
- Abrir únicamente el origen LAN necesario y restringirlo por firewall a la VM Nginx. No publicar base, Docker, compilador ni puertos administrativos.
- Parametrizar dominio y proxy en configuración privada: hosts permitidos exactos, origen CSRF exacto, cookies seguras y confianza acotada en `X-Forwarded-Proto`/host. No habilitar CORS general.
- Configurar HTTPS y renovación automática sin reutilizar certificados o secretos de otros sitios. No habilitar HSTS con `includeSubDomains` por defecto en un dominio compartido.
- Acordar antes de publicar una barrera de acceso propia de DEV delante del login de la aplicación; se recomienda Basic Auth o un mecanismo equivalente ya operado por el propietario. Si se elige deliberadamente sólo el login de CapiBloques, registrar la decisión y reforzar las pruebas de borde. Cualquier credencial adicional queda fuera del repositorio. Si el entorno debe usarse directamente con alumnos, detener esa decisión y redefinir el alcance antes de exponerlo.
- Documentar comandos de estado, logs, actualización, certificado, rollback y recuperación por túnel. Versionar sólo plantillas no secretas y pruebas.
- Tratar la URL pública como un origen de navegador nuevo. Los proyectos guardados en servidor reaparecen al ingresar, pero IndexedDB, borradores y preferencias de `http://localhost:3000` no se copian automáticamente: ofrecer un recorrido explícito de guardar/exportar y conservar el túnel para recuperar pendientes.

## Secuencia de ejecución

1. Confirmar identidades: `capi-dev`, VM Nginx, IP interna del proxy, ruta pública existente y FQDN elegido. Consultar primero; no modificar gateway, host Proxmox, router ni PRD.
2. Verificar árbol/commit, servicios y datos de DEV. Preparar respaldo proporcional de configuración y base antes de cambiar el recorrido web.
3. Implementar y probar localmente el runtime persistente y la configuración segura por dominio. Conservar el Compose actual ligado a loopback hasta que la nueva ruta esté saludable.
4. Restringir el origen interno a la VM Nginx y comprobar que otro equipo de LAN no puede usarlo directamente.
5. Dar al propietario el registro DNS exacto. Esperar su creación y comprobar propagación desde resolvers independientes; no asumir que un resultado cacheado demuestra convergencia.
6. Instalar el sitio/certificado en la VM Nginx, validar configuración y recargar. No sobrescribir el sitio predeterminado ni configuraciones compartidas.
7. Ejecutar aceptación desde una red externa en Chrome y Edge, además de regresión por túnel. Registrar commit, dominio, certificado, servicios, resultados y límites sin copiar secretos.
8. Reiniciar `capi-dev` y confirmar recuperación automática. Para la VM Nginx compartida, usar estado habilitado y prueba de renovación; un reinicio completo sólo se hace si el propietario lo autoriza específicamente.
9. Actualizar contexto de fase 11, plan, guía y evidencia; commit/push de todo lo versionable. Si algo falla, volver a la configuración respaldada y mantener el túnel funcional.

## Seguridad y operación mínima

- TLS válido, sin contenido mixto; HTTP redirige a HTTPS sólo para ese nombre.
- Aplicación/API del mismo origen. Cookies de sesión y CSRF `Secure`, `HttpOnly` según su función y `SameSite` conservado; hosts/orígenes mediante allowlist, no `*`.
- Headers de proxy aceptados únicamente porque el origen sólo recibe a la VM Nginx. El cliente no puede elegir esquema, host o identidad mediante cabeceras reenviadas.
- Límite de cuerpo coherente con logo, JSON, respaldos permitidos y firmware; timeouts diferenciados para API y descargas sin dejar peticiones ilimitadas.
- Login conserva el límite de intentos de Django y suma protección en el borde sin bloquear a todos los clientes por la IP interna del proxy ni a todo un aula por una única NAT. La IP real sólo se toma de una cadena de proxies explícitamente confiable; Nginx sobrescribe cabeceras entrantes y se prueban suplantación, múltiples clientes y límites 429. Errores no revelan alias, rutas, stack traces, secretos o configuración interna.
- Servicio habilitado al arranque, healthcheck local y externo, logs rotados y sin contraseñas/Wi-Fi. El chequeo básico no sustituye las alertas y métricas de producción.
- El firmware Wi-Fi sigue siendo privado y temporal. HTTPS protege el tránsito, pero el binario descargado continúa conteniendo la clave suministrada.

## Pruebas de aceptación

- DNS correcto y certificado válido para el FQDN exacto; protocolo, cadena, vencimiento y renovación de prueba verificados.
- Acceso externo real en Chrome y Edge: marca previa al login, login/logout, sesión periódica, permisos, biblioteca, guardar/autoguardar, recuperación, importar/exportar JSON, simulación, revisión docente, compilación y descarga.
- Cambio de origen documentado: un proyecto confirmado se abre desde la biblioteca; un borrador sólo local se recupera por el origen localhost y se guarda o exporta antes de abandonarlo. No se copia ni borra todo el almacenamiento de un perfil.
- Sin CORS abierto, errores CSRF ni cookies que viajen por HTTP. Los límites de login distinguen clientes legítimos sin aceptar un `X-Forwarded-For` falsificado. Web Serial informa contexto seguro; la ausencia de placa no se presenta como aceptación física.
- Archivo dentro del límite funciona; exceso se rechaza. Cortes, respuesta lenta y renovación de sesión no pierden el proyecto ni dejan una pantalla de desarrollo expuesta.
- `capi-dev` vuelve solo después de reiniciar. Parada/arranque/reload y rollback están documentados y probados sin `down -v`, prune, regeneración de secretos ni pérdida de datos.
- Comprobación de exposición desde un origen externo confirma únicamente lo previsto. El nuevo puerto/origen web interno no responde a clientes distintos de la VM Nginx y no publica Django, PostgreSQL, Docker, compilador o SSH a Internet; el SSH administrativo de LAN/salto conserva sus reglas existentes.
- La protección de acceso acordada para DEV se comprueba; datos y cuentas usados son sintéticos. Otros sitios del Nginx compartido continúan respondiendo antes y después de la recarga.

## Reversión

1. Retirar sólo el bloque de sitio dedicado o restaurar su copia validada y recargar Nginx.
2. Cerrar la regla de firewall/origen agregada en DEV.
3. Detener únicamente el nuevo runtime público y volver al acceso por túnel loopback.
4. El propietario retira o corrige el DNS si corresponde.
5. Confirmar que no se tocaron PRD, gateway, host Proxmox, otros sitios, base ni volúmenes.

La reversión de publicación no implica borrar proyectos ni regenerar secretos. Los cambios materiales se registran con su prueba y resultado.
