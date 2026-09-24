# Fase 33 — Wi-Fi AP/cliente y mensajes entre placas

Estado al 24 de septiembre de 2026: **implementada y verificada en software; actualización de DEV y aceptación física pendientes**.

## Qué se entregó

- El componente Wi-Fi se configura en la escena como **Crear una red** o **Conectarse a una red**. También define un nombre corto para esta placa, placas conocidas y una lista editable de mensajes.
- Los bloques **enviar por Wi-Fi** y **cuando llegue por Wi-Fi** usan esas listas. La recepción tiene tres caminos: mensaje esperado, mensaje distinto y tiempo agotado. Esperar es cooperativo y no detiene otros caminos.
- El simulador permite inyectar mensajes predefinidos como si provinieran de otra placa y muestra enviados, recibidos y rechazados.
- Arduino, ESP-IDF y `CapiRules`/firmware intérprete generan o ejecutan el mismo comportamiento. El intérprete requerido pasa a `1.3.0` y negocia la capacidad `wifi-messages`.
- Los últimos mensaje y remitente válidos se pueden usar como datos comunes de fase 32.

## Protocolo de aplicación

Se usa UDP broadcast en el puerto `4217`, con una trama binaria propia: magia `CBW`, versión, número de secuencia, longitudes, remitente, destinatario, texto UTF-8 y CRC-16. Cada identidad admite letras, números, guion y guion bajo, con hasta 24 caracteres. El texto admite de 1 a 120 bytes.

El destinatario puede ser una placa conocida o `*`. La recepción valida la trama completa, descarta mensajes dirigidos a otra placa y conserva, para hasta ocho remitentes, la última secuencia aceptada. Así una retransmisión no vuelve a ejecutar una acción. Los buffers son fijos, el sondeo es no bloqueante y cada espera exige un timeout de 0,1 a 300 segundos.

Esta primera versión **no es control remoto implícito**: una placa envía texto y el programa receptor decide qué hacer localmente. Los servicios remotos tipados siguen separados en fase 34.

## Credenciales y límites

El SSID forma parte de la descripción de la escena, pero la contraseña no entra en el proyecto JSON, historial, Git, código visible ni telemetría. Se entrega de forma privada al compilar o aprovisionar el firmware intérprete por Web Serial. Una placa que crea la red admite inicialmente hasta cuatro conexiones en el runtime; el proyecto guarda hasta ocho nombres de placas conocidas.

La simulación valida la lógica de una placa y sus entradas virtuales, no emula radio, cobertura o congestión. Si el receptor no está disponible, UDP no ofrece confirmación de entrega; el envío termina sin bloquear y la lógica que necesite confirmación debe usar un mensaje de respuesta y timeout.

## Verificación realizada

- Migración de escenas anteriores y validación de roles, nombres, listas y límites.
- Codificación/decodificación, CRC, texto UTF-8, destinatario y rechazo de tramas dañadas.
- Grafo de tres ramas, timeout, simulador y generación Arduino/ESP-IDF.
- Capacidad `wifi-messages`, operaciones y datos de servicio en el firmware intérprete `1.3.0`.
- `npm run typecheck`, `npm run test:smoke`, `npm run lint`, `npm run build` y `npm run test:idf-driver`.

## Aceptación física pendiente

Antes de anunciar interoperabilidad física hay que actualizar DEV, generar/publicar el intérprete `1.3.0` y ensayar una placa AP más dos clientes: desconexión/reconexión, mensajes simultáneos, duplicados, trama alterada, timeout y reinicio. También hay que medir el máximo práctico de clientes y documentar diferencias entre Wemos D1 R32, ESP32-S3 DevKitC y Waveshare. La falta de placas no se reemplaza con una simulación.
