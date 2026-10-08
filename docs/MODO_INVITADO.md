# Modo invitado — primera entrega

Autorizado el 8 de octubre de 2026. Esta ampliación transversal no se asigna a
una fase numerada y cubre sólo el ingreso como invitado y el acceso al editor
con guardado local.

## Implementación en checkout

- La pantalla de ingreso ofrece **Ingresar como invitado**, incluso si la API
  de cuentas no está disponible. La acción abre el editor directamente sin
  crear una cuenta ni validar una sesión.
- El editor recupera y guarda el proyecto en IndexedDB bajo una partición
  anónima, separada de los UUID de cuenta. Recargar o cerrar la página no
  elimina esa copia. El menú también permite guardar explícitamente en este
  navegador.
- La cabecera identifica el modo invitado y ofrece ir al login después de
  completar las escrituras locales pendientes.
- La primera entrega no expone biblioteca de proyectos de cuenta, desafíos,
  compilación específica, firmware ni asistente/uso de placa. No implementa una
  migración automática ni la oferta de guardar el proyecto invitado en una
  cuenta al iniciar sesión.

## Límites y estado

La copia queda en el perfil local del navegador y no es un respaldo. No protege
contra otras personas que puedan usar ese perfil o dispositivo. Borrar los datos
del sitio puede eliminarla. El modo invitado no autentica ante la API ni debe
usarse para añadir operaciones remotas.

Typecheck completo y lint dirigido de los componentes modificados pasaron. Se
agregó una prueba E2E para ingreso/recuperación/bloqueos, pero no pudo arrancar:
falta el binario Chromium local de Playwright. `git diff --check` pasó. No se
instalaron navegadores, no se desplegó DEV y la aceptación en navegador sigue
pendiente.
