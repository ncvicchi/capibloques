import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { examples } from '../lib/capiblocks.ts';
import { sonarFirmwareSupport } from '../lib/sonar-firmware.ts';
const dir = 'work/sonar-driver';
await mkdir(dir + '/driver', { recursive: true });
await writeFile(
  dir + '/driver/gpio.h',
  `#pragma once
#include <cstdint>
#include <cassert>
using gpio_num_t=int;using esp_err_t=int;
constexpr int GPIO_MODE_INPUT=0,GPIO_MODE_OUTPUT=1,GPIO_INTR_ANYEDGE=3,ESP_OK=0,ESP_ERR_INVALID_STATE=2;
extern uint32_t clock_us;extern int level;extern void(*callback)(void*);extern void *argument;
inline int gpio_get_level(int pin){assert(pin==34);return level;}
inline int gpio_set_direction(int pin,int){assert(pin==17||pin==34);return 0;}
inline int gpio_set_level(int pin,int value){assert(pin==17);assert(value==0||value==1);return 0;}
inline int gpio_install_isr_service(int flags){assert(flags==0);return ESP_ERR_INVALID_STATE;}
inline int gpio_set_intr_type(int pin,int type){assert(pin==34&&type==GPIO_INTR_ANYEDGE);return 0;}
inline int gpio_isr_handler_add(int pin,void(*handler)(void*),void*arg){assert(pin==34);callback=handler;argument=arg;return 0;}
`,
);
await writeFile(
  dir + '/esp_timer.h',
  '#pragma once\n#include <cstdint>\nextern uint32_t clock_us;inline int64_t esp_timer_get_time(){return clock_us;}\n',
);
await writeFile(
  dir + '/esp_rom_sys.h',
  '#pragma once\n#include <cassert>\ninline void esp_rom_delay_us(int us){assert(us==10);}\n',
);
for (const native of [false, true]) {
  const code = `#include <cstdint>
uint32_t clock_us=0;int level=0;void(*callback)(void*)=nullptr;void*argument=nullptr;
double STATE_distance=0;bool STATE_valid=false;
${sonarFirmwareSupport(examples.find((e) => e.id === 'gorillaAutonomy').scene, native, (_, key) => 'STATE_' + key)}
int main(){capiSonarBegin();assert(CAPI_SONAR_READY&&callback);capiSonarService();assert(!STATE_valid);
 clock_us=100;level=1;callback(argument);clock_us=5900;level=0;callback(argument);clock_us=6000;capiSonarService();assert(STATE_valid&&STATE_distance==100);
 clock_us=60000;capiSonarService();clock_us=90001;capiSonarService();assert(!STATE_valid&&STATE_distance==0);
}`;
  await writeFile(dir + '/test.cpp', code);
  const c = spawnSync(
    'g++',
    [
      '-std=c++17',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-I' + dir,
      dir + '/test.cpp',
      '-o',
      dir + '/test.exe',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(c.status, 0, c.stderr);
  const r = spawnSync(dir + '/test.exe', [], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}
console.log(
  'HC-SR04: adaptador real Arduino/IDF compilado con HAL; IRQ, disparo, lectura y timeout aprobados (no SDK ni placa física).',
);
