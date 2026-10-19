import type { SceneDefinition } from './scene-model';
// @ts-expect-error Node strip-types runner.
import { gorillaCore } from './gorilla-core.ts';
export function gorillaFirmwareSupport(
  scene: SceneDefinition,
  symbols: Map<string, string>,
  native: boolean,
  state: (id: string, key: string) => string,
) {
  const d = scene.devices.find((d) => d.kind === 'gorilla');
  if (!d || d.kind !== 'gorilla') return '';
  const s = d.config.settings,
    symbol = symbols.get(d.id)!;
  return `
#include <cmath>
${native ? '#include "driver/i2c_master.h"' : '#include <Wire.h>'}
${gorillaCore}
CapiGorilla CAPI_GORILLA;
${native ? 'i2c_master_bus_handle_t CAPI_G_BUS=nullptr; i2c_master_dev_handle_t CAPI_G_DEVICE=nullptr;' : 'TwoWire CAPI_G_BUS(1); bool CAPI_G_OPEN=false;'}
bool capiGorillaTransfer(const uint8_t *bytes,size_t size){
 ${native ? 'return CAPI_G_DEVICE&&i2c_master_transmit(CAPI_G_DEVICE,bytes,size,5)==ESP_OK;' : `CAPI_G_BUS.beginTransmission(${Number(s.address)});CAPI_G_BUS.write(bytes,size);return CAPI_G_BUS.endTransmission()==0;`}
}
bool capiGorillaWrite(int channel,int angle){uint16_t ticks=(uint16_t)std::lround((1000.0+angle*1000.0/180.0)*4096.0/20000.0);uint8_t data[]={(uint8_t)(6+channel*4),0,0,(uint8_t)(ticks&255),(uint8_t)(ticks>>8)};return capiGorillaTransfer(data,sizeof(data));}
bool capiGorillaPrepare(){
 if(!${!!s.verified}){CAPI_GORILLA.error=true;return false;}
 if(CAPI_GORILLA.ready){CAPI_GORILLA.error=false;return true;}
 ${
   native
     ? `if(!CAPI_G_BUS){i2c_master_bus_config_t bus={};bus.i2c_port=I2C_NUM_1;bus.sda_io_num=(gpio_num_t)${d.pins.sda ?? 255};bus.scl_io_num=(gpio_num_t)${d.pins.scl ?? 255};bus.clk_source=I2C_CLK_SRC_DEFAULT;bus.glitch_ignore_cnt=7;bus.flags.enable_internal_pullup=true;if(i2c_new_master_bus(&bus,&CAPI_G_BUS)!=ESP_OK)return false;}
 if(!CAPI_G_DEVICE){i2c_device_config_t config={};config.dev_addr_length=I2C_ADDR_BIT_LEN_7;config.device_address=${Number(s.address)};config.scl_speed_hz=100000;if(i2c_master_bus_add_device(CAPI_G_BUS,&config,&CAPI_G_DEVICE)!=ESP_OK)return false;}`
     : `if(!CAPI_G_OPEN){if(!CAPI_G_BUS.begin(${d.pins.sda ?? 255},${d.pins.scl ?? 255},100000))return false;CAPI_G_BUS.setTimeOut(5);CAPI_G_OPEN=true;}`
 }
 const uint8_t sleep[]={0,0x30},pre[]={0xfe,121},wake[]={0,0x20};
 if(!capiGorillaTransfer(sleep,2)||!capiGorillaTransfer(pre,2)||!capiGorillaTransfer(wake,2))return false;
 ${native ? 'vTaskDelay(pdMS_TO_TICKS(1)+1);' : 'delayMicroseconds(600);'}
 ${Array.from({ length: 8 }, (_, i) => `CAPI_GORILLA.center[${i}]=${Number(s[`center${i}`])};CAPI_GORILLA.low[${i}]=${Number(s[`min${i}`])};CAPI_GORILLA.high[${i}]=${Number(s[`max${i}`])};CAPI_GORILLA.channel[${i}]=${Number(s[`channel${i}`])};CAPI_GORILLA.reversed[${i}]=${!!s[`reversed${i}`]};`).join('\n')}
 CAPI_GORILLA.write=capiGorillaWrite;CAPI_GORILLA.start(0,0,0,0,0,0);return true;
}
void capiGorillaService(uint32_t now){CAPI_GORILLA.service(now);${Array.from({ length: 8 }, (_, i) => `${state(d.id, `j${i}`)}=std::lround(CAPI_GORILLA.position[${i}]);`).join('')}${state(d.id, 'ready')}=CAPI_GORILLA.ready;${state(d.id, 'moving')}=CAPI_GORILLA.busy;${state(d.id, 'error')}=CAPI_GORILLA.error;}
// Servo board exclusively owns I2C1. No pulses before an explicit movement.
// Eight external channels consume no ESP32 LEDC channels.
// Motor configuration: ${symbol}
`;
}
