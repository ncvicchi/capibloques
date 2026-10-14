# Modo invitado — alcance y ampliación USB

Autorizado el 8 de octubre de 2026, sin asignarlo a una fase numerada. La
primera entrega agregó ingreso y editor con guardado local anónimo. El 14 de
octubre se autorizó ampliar el recorrido para instalar el firmware intérprete
CapiBloques y ejecutar por USB los programas creados en el editor.

## Implementación

- La pantalla de ingreso ofrece **Ingresar como invitado**, incluso si la API
  de cuentas no está disponible. No crea cuenta ni valida sesión.
- El proyecto se recupera y guarda en IndexedDB bajo una partición anónima,
  separada de los UUID de cuenta. La cabecera identifica el modo y ofrece ir al
  login después de completar las escrituras locales pendientes.
- **Usar en placa** abre el asistente existente. El invitado puede instalar el
  firmware intérprete publicado para una placa compatible, enviar reglas
  generadas localmente y ejecutar, pausar, continuar o detener el programa por
  USB.
- El asistente invitado no consulta una sesión. El proyecto y las reglas no se
  envían a la API; el firmware se obtiene de los artefactos estáticos publicados
  y Web Serial conecta el navegador con la placa.
- Se conservan las comprobaciones de compatibilidad de placa, firmware, ABI,
  capacidades y tamaño, así como las confirmaciones previas al flasheo.

## Límites

No incluye biblioteca de cuenta, desafíos, compilación específica por proyecto,
monitor Serial/herramientas avanzadas, migración u oferta automática para
guardar en una cuenta ni control remoto de la placa. La compilación específica
sigue requiriendo una cuenta. El flujo necesita Chrome o Edge de escritorio en
HTTPS o localhost.

El proyecto permanece en el perfil local del navegador y no es un respaldo. No
protege contra otras personas que usen ese perfil; borrar los datos del sitio
puede eliminarlo. Instalar firmware reemplaza el programa que tuviera la placa.
No se despliega DEV automáticamente y la aceptación física se registra aparte.

## Verificación y entrega

La ampliación pasó `tsc --noEmit` y oxlint dirigido a los componentes
modificados. La prueba E2E invitado quedó preparada, pero Playwright no pudo
lanzar Chromium porque falta su ejecutable local; no se instaló el navegador.
`git diff --check` pasó. No se probó una placa física ni se desplegó DEV; ambas
aceptaciones quedan pendientes.
