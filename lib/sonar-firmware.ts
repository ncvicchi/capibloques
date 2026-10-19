import type { SceneDefinition } from './scene-model';
export const sonarCore = String.raw`#include <atomic>
#include <cstdint>
// Edge timestamps are acquired by GPIO interrupts, never by polling the echo.
struct CapiSonar {
  std::atomic<uint32_t> rise{0},width{0},captured{0};std::atomic<bool> armed{false},high{false},complete{false};
  uint32_t last=0,sent=0;std::atomic<uint32_t> sampled{0};std::atomic<int> distance{0};std::atomic<bool> valid{false};bool pending=false,started=false;
  void reset(){armed=false;high=false;complete=false;rise=0;width=0;captured=0;sampled=0;distance=0;valid=false;last=sent=0;pending=started=false;}
  bool fresh(uint32_t us)const{return valid.load()&&(uint32_t)(us-sampled.load())<=250000;}
  void edge(bool level,uint32_t us){
    if(!armed.load())return;
    if(level){if(!high.exchange(true))rise=us;}
    else if(high.exchange(false)){width=us-rise.load();captured=us;complete=true;armed=false;}
  }
  bool tick(uint32_t us,int maximum=400){
    if(pending&&complete.exchange(false)){uint32_t pulse=width.load();distance=(int)((pulse+29)/58);sampled=captured.load();valid=pulse>=116&&pulse<=23200&&distance.load()<=maximum&&(uint32_t)(us-sampled.load())<=250000;pending=false;}
    if(pending&&(uint32_t)(us-sent)>=30000){pending=false;armed=false;valid=false;distance=0;sampled=us;}
    if(valid&&(uint32_t)(us-sampled.load())>250000)valid=false;
    if(!pending&&(!started||(uint32_t)(us-last)>=60000)){
      started=true;last=sent=us;pending=true;complete=false;high=false;armed=true;return true;
    }
    return false;
  }
  uint32_t age(uint32_t us)const{return started?(uint32_t)(us-sampled)/1000:251;}
};
`;
export function frontSonar(scene: SceneDefinition) {
  if (!scene.devices.some((d) => d.kind === 'gorilla')) return undefined;
  const sensors = scene.devices.filter((d) => d.kind === 'distanceSensor');
  return sensors.length === 1 && sensors[0].config.profile === 'HC-SR04'
    ? sensors[0]
    : undefined;
}
export function sonarFirmwareSupport(
  scene: SceneDefinition,
  _native: boolean,
  state: (id: string, key: string) => string,
) {
  const d = frontSonar(scene);
  if (!d) return '';
  return `
#include "driver/gpio.h"
#include "esp_timer.h"
#include "esp_rom_sys.h"
${sonarCore}
CapiSonar CAPI_SONAR;
bool CAPI_SONAR_READY=false;
void capiSonarEdge(void*){CAPI_SONAR.edge(gpio_get_level((gpio_num_t)${d.pins.echo ?? 255})!=0,(uint32_t)esp_timer_get_time());}
void capiSonarBegin(){
 gpio_set_direction((gpio_num_t)${d.pins.trigger ?? 255},GPIO_MODE_OUTPUT);gpio_set_level((gpio_num_t)${d.pins.trigger ?? 255},0);
 gpio_set_direction((gpio_num_t)${d.pins.echo ?? 255},GPIO_MODE_INPUT);
 esp_err_t service=gpio_install_isr_service(0);if(service!=ESP_OK&&service!=ESP_ERR_INVALID_STATE)return;
 if(gpio_set_intr_type((gpio_num_t)${d.pins.echo ?? 255},GPIO_INTR_ANYEDGE)!=ESP_OK)return;
 CAPI_SONAR_READY=gpio_isr_handler_add((gpio_num_t)${d.pins.echo ?? 255},capiSonarEdge,nullptr)==ESP_OK;
}
void capiSonarService(){
 uint32_t us=(uint32_t)esp_timer_get_time();
 if(CAPI_SONAR_READY&&CAPI_SONAR.tick(us,${Math.max(2, Math.min(400, Math.round(Number(d.config.settings.maxDistance) || 400)))})){
  gpio_set_level((gpio_num_t)${d.pins.trigger ?? 255},1);esp_rom_delay_us(10);gpio_set_level((gpio_num_t)${d.pins.trigger ?? 255},0);
 }
 ${state(d.id, 'distance')}=CAPI_SONAR.fresh(us)?CAPI_SONAR.distance.load():0;
 ${state(d.id, 'valid')}=CAPI_SONAR_READY&&CAPI_SONAR.fresh(us);
}
`;
}
