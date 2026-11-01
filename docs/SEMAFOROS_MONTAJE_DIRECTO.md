# Semáforos: asignación por cantidad y orientación

Pedido del propietario, 01/11/2026. Rama `codex/dev3-semaforos-conexion-automatica`,
continuación de la guía de conexiones en DEV3. Sin cambios de main/dev1/dev2.

## Política

- Uno o dos semáforos: priorizar un módulo directo en cuatro contactos
  consecutivos, sin usar UART0, USB ni los pines I2C habituales.
- Tres o cuatro: usar cables y GND real; priorizar ternas contiguas físicamente
  en el conector, no números GPIO consecutivos. Si no alcanza para todas las
  ternas, agrupar las restantes todo lo posible sin inventar salidas.
- Respetar pines ocupados por otros componentes/carteles. Si no queda un
  grupo directo libre, proponer cables; si tampoco quedan señales, mantener
  la simulación y bloquear hardware mediante los diagnósticos existentes.

### Wemos D1 R32

Grupos confirmados por el propietario considerando las aletas del módulo.
Valores en orden **GND, R, Y, G**:

| Módulo | Normal | Invertido |
|---|---|---|
| S1 | 26, 25, 17, 16 | 16, 17, 25, 26 |
| S2 | 5, 23, 19, 18 | 18, 19, 23, 5 |

No usar RX0/TX0, GPIO12 ni entradas 34–39. GPIO5 se habilita exclusivamente
como parte del grupo completo S2, incluida su inversión; no se ofrece para
asignación automática a otras cargas. GPIO5 es un strap de temporización del
SDIO esclavo, distinto del strap GPIO12 de tensión de flash:
[referencia Espressif](https://documentation.espressif.com/esp32_datasheet_en.html).
El montaje necesita aceptación física con encendido/reinicio; no afirmar
que la compilación prueba corriente, arranque o encaje mecánico.

Con tres semáforos quedan disponibles ternas 18/19/23, 14/27/16 y 17/25/26.
Con cuatro se usan además 13/21/22: esta última no es una terna contigua.
21 y 22 son SDA/SCL; sólo se toman si están libres. No se promete conservar
I2C cuando cuatro semáforos ya necesitan doce salidas.

### DIYmall ESP32-S3 DevKit N16R8

Grupos directos 4/5/6/7 y 15/16/17/18 (GND/R/Y/G), o sus inversos.
No ocupar UART0 43/44, USB 19/20, BOOT/straps ni PSRAM 35–37.
La posición de conectores deriva del mapa DevKitC v1.0; el espacio físico
entre dos módulos con sus aletas queda pendiente de prueba en esa placa.

## Aplicación y compatibilidad

La asignación automática se usa al agregar componentes nuevos y mediante
**Auto conectar**. Los montajes manuales/guardados válidos no se recablean
al abrir. Al pasar de dos directos a tres semáforos se recalculan las señales
y se avisa que hay que llevar los GND a GND real. Al quitar un semáforo desde
el editor se optimizan los restantes según la nueva cantidad y se avisa;
el historial incluye ese cambio. Auto conectar también permite optimizar
explícitamente proyectos existentes. Revisar antes de modificar el montaje físico.

El retorno se guarda como `pins.common`, opcional: JSON antiguo sin esa
propiedad sigue siendo válido. Un retorno numérico sólo es válido dentro
de uno de los grupos completos. Cuenta como GPIO ocupado y no se comparte.
La inversión cambia los cuatro pines conjuntamente dentro del borrador;
usa Guardar cambios/Guardar escena y el historial existente. Se conserva
al volver a Auto conectar mientras el montaje siga siendo directo.

En Armar escena, propiedades del semáforo: **Invertir orientación**.
La guía muestra el módulo girado y mueve el cable al pin físico correcto;
GND del módulo puede ir al GPIO de retorno indicado, no a un GND imaginario.
La opción LED sueltos del recorrido sigue mostrando cátodos a GND real;
no modifica la asignación guardada y el retorno reservado queda sin conectar.

## Firmware y exportaciones

Intérprete **1.15.0 / ABI 1**, capacidades `traffic-digital` y `traffic-direct`.
Actualizar las tres publicaciones, cliente y exportador juntos. Las reglas
con semáforos requieren la capacidad digital; con retorno, también direct.

Las luces usan salidas digitales y dejan libres los canales LEDC. Así doce
luces de cuatro semáforos funcionan también en S3, que tiene ocho canales PWM.
Antes de encender un color, apagar las tres señales, mantener common en LOW
y encender la elegida. Inicio y STOP conservan señales apagadas y retorno LOW.
Se retira una asignación PWM anterior del mismo GPIO antes de usarlo digital.
Arduino/ESP-IDF nativos también configuran el retorno LOW; no es sólo un dibujo.
Waveshare principal sigue siendo virtual: las reglas retiran los GPIO físicos
sin modificar el proyecto original.

## Validación

Modelo: uno/dos/tres/cuatro semáforos en ambas placas, grupos físicos,
restricciones, inversión, GPIO únicos, compatibilidad JSON, exportaciones y
requisitos PWM. Prueba C++ ejecuta la rama real del intérprete y verifica
apagado previo, retorno LOW y liberación del PWM anterior. SDK ESP-IDF5.5.5
compilado para los tres perfiles, usando objetos/caché persistentes.
Aceptación física de los montajes directos y orientación pendiente.
