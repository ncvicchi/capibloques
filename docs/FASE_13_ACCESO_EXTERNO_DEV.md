# Fase 13 — Acceso externo persistente a DEV

Estado: **planificada el 12 de septiembre de 2026; no implementada**. El propietario pidió anteponerla al backlog funcional. Iniciarla requiere una indicación explícita para ejecutar la fase completa.

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
