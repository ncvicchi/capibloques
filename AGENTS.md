# Reglas de trabajo de CapiBloques

## Fases y autorización

- Trabajar una fase o subfase acotada por vez. Informar alcance al comenzar y dar actualizaciones breves durante el trabajo; no pasar largos períodos sin informar al propietario.
- Implementar, probar y entregar el resultado de la fase. No avanzar a la siguiente sin el OK del propietario. Informar pendientes o fallos sin presentarlos como completados.
- Hacer commit y push de los cambios versionables verificados de cada entrega. Si no se puede publicar, comunicarlo. No incluir cambios ajenos ni secretos.
- El plan principal es `docs/PLAN_MULTIUSUARIO_PROXMOX.md`; el estado de preparación está en `docs/FASE_0_SERVIDORES.md`. El plan no demuestra que las funciones estén implementadas.

## Infraestructura y límites estrictos

- La infraestructura autorizada para preparar la aplicación son las VMs 112 (desarrollo, hostname `capi-dev`) y 113 (producción, hostname `capi-prd`). Confirmar identidad antes de mutaciones remotas.
- El gateway/bastión es EXCLUSIVAMENTE un salto SSH. PROHIBIDO ejecutar allí comandos de administración, instalar, reiniciar, editar archivos/configuración o copiar credenciales. Usar reenvío TCP SSH/ProxyJump sin sesión de comandos. No reenviar el agente SSH.
- No modificar el host Proxmox, router ni VM Nginx como efecto incidental de preparar las VMs. Cualquier trabajo futuro allí necesita una solicitud explícita y acotada; la prohibición de cambios en el gateway permanece vigente.
- No guardar contraseñas, tokens, claves privadas, sus rutas locales ni detalles del gateway en el repositorio, logs o documentación pública. Las credenciales se configuran fuera de Git.
- Avisar cuando Git esté disponible en las VMs para que el propietario autentique GitHub. No crear una cuenta del asistente ni copiar credenciales personales de desarrollo a producción.
- Respetar los recursos reales de las VMs. No aumentar asignaciones ni instalar toolchains pesadas sin corresponder a la fase. No convertir un contenedor privilegiado o acceso al socket Docker en un atajo.
- GitHub Pages deja de utilizarse por decisión del propietario; conservar CI y no reactivar publicación automática. No publicar en Sites ni crear recursos de hosting alternativos.

## Producto

- Conservar Arduino y agregar ESP-IDF como opciones. No reemplazar uno por otro.
- Flujo previsto: simular en navegador, compilar, descargar/grabar por USB y ejecutar autónomamente. No agregar control físico en vivo.
- Mantener exportación/importación JSON, compatibilidad de proyectos y pruebas existentes. Validar comportamiento y hardware por separado.
