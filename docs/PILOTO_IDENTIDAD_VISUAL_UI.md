# Piloto de identidad visual en la interfaz

**Estado:** implementado localmente el 8 de octubre de 2026. No desplegado.
**Alcance:** login/cuenta, favicon y un acento de isotipo en la etiqueta de Proyecto del encabezado. No es un cambio de tema global.

## Concepto

La interfaz toma del logo la calidez del crema, la legibilidad del espresso y el acento turquesa. El movimiento del pattern aparece únicamente en el fondo de la pantalla de cuenta. El formulario, los mensajes y los controles permanecen quietos y sobre superficies sólidas.

## Reglas implementadas

### Fondo animado del login/cuenta

- Base crema `#FFF1D6` con el recurso repetible `public/brand/capibloques-pattern.svg`.
- El patrón se aplica en un pseudo-elemento decorativo de pantalla completa, por detrás del contenido y sin capturar eventos.
- Opacidad CSS `0.18`, módulo de `240 × 160 px` y animación lineal de `72 s` desde `0 0` hasta `240px 160px` para cerrar el ciclo en el siguiente módulo repetido.
- El panel conserva fondo casi blanco (`#FFFDF8`), borde cálido y sombra suave para mantener el formulario legible.
- No hay movimiento ligado al cursor ni al scroll; es un desplazamiento CSS constante en diagonal.
- `prefers-reduced-motion: reduce` deja el pattern quieto. En impresión se retira el pattern.

### Marca y controles de cuenta

- El isotipo reemplaza la huella decorativa junto al título; el avatar personal sigue siendo una acción independiente en el editor.
- El wordmark de texto separa “Capi” espresso y “Bloques” turquesa.
- Acciones primarias del panel usan turquesa con texto blanco; campos claros usan borde cálido; los estados de error y confirmación conservan sus colores semánticos.
- El foco de teclado en controles del área de cuenta usa un anillo turquesa de 3 px. Las etiquetas y mensajes continúan visibles sin depender del color.
- El logo institucional que presenta `SchoolBrand` conserva su posición e identidad; no se reemplaza por el logo del producto.

### Favicon y encabezado

- `public/favicon.svg` pasa a mostrar el isotipo de CapiBloques y `app/layout.tsx` declara explícitamente ese recurso.
- La etiqueta “Proyecto” del encabezado incorpora un isotipo pequeño. No ocupa el lugar del avatar personal ni cambia los controles de Proyecto.
- El marcado del encabezado existente oculta el selector de nombre del proyecto bajo 1100 px; por eso este acento aparece donde esa etiqueta está visible. No se alteró el layout responsivo general.

## Límites preservados

- No se cambian la paleta general del editor, Blockly, colores de categorías, semáforos, advertencias, errores, estados de ejecución ni cableado.
- Crear/Probar, Ejecutar/Pausar/Paso, Usar en placa, Proyecto/Más y sus ubicaciones permanecen iguales.
- El pattern no se aplica a la mesa de bloques, escenas, código ni formularios administrativos.
- No se carga una fuente web nueva: el entorno mantiene su tipografía existente. Nunito Sans sigue siendo la recomendación de identidad para una adopción tipográfica posterior, que requerirá decidir y empaquetar la fuente.

## Archivos involucrados

- `components/account-access.tsx`: isotipo y wordmark bicolor en login/cuenta.
- `components/capiblocks-app.tsx`: isotipo compacto en la etiqueta Proyecto del encabezado.
- `app/globals.css`: tokens de marca, estilo localizado y ciclo de fondo con movimiento reducido.
- `app/layout.tsx`, `public/favicon.svg`: selección del favicon de marca.
- `public/brand/capibloques-isotipo.svg`, `public/brand/capibloques-pattern.svg`: recursos gráficos.
- `docs/MANUAL_DE_MARCA_CAPIBLOQUES.md`: reglas generales de la marca actualizadas.

## Revisión y aceptación parcial — 8 de octubre de 2026

- `oxlint` en los componentes tocados: aprobado.
- `tsc --noEmit`: aprobado.
- `vinext build`: aprobado; prerenderizó las nueve rutas. Emitió el aviso habitual de chunk mayor a 500 kB, sin fallar.
- `git diff --check`: aprobado.
- Los cuatro SVG (favicon, logo, isotipo y pattern) parsean como XML válido.
- Inspección en navegador integrado a 614 × 614: se ve el fondo de encastres con poco contraste y la tarjeta queda sólida, legible y por encima del patrón. Se observaron fases distintas del desplazamiento. El CSS recorre una baldosa exacta (240 × 160 px), pero no se esperó un ciclo completo de 72 segundos; la continuidad visual en el punto de reinicio sigue pendiente.
- Navegación por Tab en el estado de error: el foco pasa por los botones en orden y el anillo turquesa se distingue claramente. El árbol de accesibilidad anuncia el H1, el error, “Reintentar conexión” e “Ingresar como invitado”. El isotipo no añade una parada o nombre redundante porque tiene texto alternativo vacío.
- Cálculo WCAG: espresso sobre `#FFFDF8` 14.65:1; turquesa sobre `#FFFDF8` 4.73:1; blanco sobre el turquesa del botón 4.81:1; el turquesa de foco sobre crema 4.31:1, superior al mínimo 3:1 para indicador no textual. El patrón es decorativo y su contraste queda reducido por opacidad.
- La regla CSS de `prefers-reduced-motion` apaga la animación; no se pudo emular dinámicamente esa preferencia en el navegador de revisión.

### Limitaciones antes de aceptación completa

El servidor local de Vinext responde 404 en `/api/auth/session/` y `/api/school/`. Por eso el navegador sólo mostró el estado de error de conexión: no se pudo revisar visualmente el formulario de credenciales ni el logo institucional presente en una sesión normal. El editor con sesión/invitado tampoco llegó a renderizar su encabezado en ese entorno; el isotipo de “Proyecto” se verificó por markup/CSS, no por captura. El navegador integrado expuso 614 × 614 y no permitió cambiar viewport, así que quedan pendientes capturas en desktop (>1100 px) y móvil (<540 px), incluida la barra del editor en desktop.

Resultado: la implementación compila y los elementos observados pasan la revisión inicial de contraste, foco y jerarquía visual. **Aceptación completa del piloto todavía pendiente** hasta revisar login normal y encabezado en viewports representativos, además de activar movimiento reducido en navegador. No se ejecutaron pruebas E2E ni se desplegó DEV. La identidad SVG sigue siendo la reconstrucción inicial documentada en el manual, no una vectorización certificada del logo de referencia.
