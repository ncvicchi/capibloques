// Execute the generated native C++ against deterministic HAL doubles.
// This checks runtime contracts, not physical hardware or the ESP-IDF ABI (CI compiles that).
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateEspIdfCodeResult } from '../lib/capiblocks.ts';
import { firmwareFixture } from './firmware-fixtures.mjs';
import { displayConfig, displayProfiles } from '../lib/display-model.ts';
import { addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';

const directory = resolve('work/idf-driver-test');
const stub = `#pragma once
#include <cassert>
#include <cstdint>
#include <cstring>
#include <deque>
#include <vector>
#include <array>
constexpr int ESP_OK = 0, pdTRUE = 1, pdPASS = 1, portMAX_DELAY = -1;
#define ESP_ERROR_CHECK(call) assert((call) == ESP_OK)
#define ESP_IDF_VERSION_VAL(a,b,c) ((a)*10000+(b)*100+(c))
#define ESP_IDF_VERSION ESP_IDF_VERSION_VAL(5,5,5)
#define CONFIG_IDF_TARGET_ESP32 1
int pdMS_TO_TICKS(int value) { return value; }
int64_t testMicros = 0;
int64_t stopAtMicros = INT64_MAX;
struct TestStop {};
int64_t esp_timer_get_time() { return testMicros; }
void vTaskDelay(int ticks) { assert(ticks >= 0); testMicros += ticks * 1000; if(testMicros>=stopAtMicros) throw TestStop{}; }
using QueueHandle_t = std::deque<const char*>*;
std::deque<const char*> messages;
std::vector<int64_t> messageTimes;
QueueHandle_t xQueueCreate(int size, int item) { assert(size == 32 && item == sizeof(const char*)); return &messages; }
int xQueueSend(QueueHandle_t queue, const char** text, int wait) {
  assert(wait == 0); if (queue->size() == 32) return 0; queue->push_back(*text); messageTimes.push_back(testMicros); return pdTRUE;
}
int xQueueReceive(QueueHandle_t queue, const char** text, int) {
  if (queue->empty()) return 0;
  *text = queue->front(); queue->pop_front(); return pdTRUE;
}
int xTaskCreate(void(*)(void*), const char*, int stack, void*, int, void*) { assert(stack == 4096); return pdPASS; }
using gpio_num_t = int;
constexpr int GPIO_MODE_OUTPUT=1, GPIO_MODE_INPUT=2, GPIO_PULLUP_ENABLE=1, GPIO_PULLUP_DISABLE=0;
struct gpio_config_t { uint64_t pin_bit_mask; int mode; int pull_up_en; };
int levels[40] = {}, configurations[40] = {}, pullups[40] = {};
int gpio_config(const gpio_config_t* config) {
  for (int pin = 0; pin < 40; ++pin) if (config->pin_bit_mask & (1ULL << pin)) { ++configurations[pin]; pullups[pin] = config->pull_up_en; }
  return ESP_OK;
}
int gpio_set_level(gpio_num_t pin, int value) { assert(pin >= 0 && pin < 40); levels[pin] = value; return ESP_OK; }
int gpio_get_level(gpio_num_t pin) { return levels[pin]; }
using ledc_mode_t=int; using ledc_channel_t=int; using ledc_timer_t=int; using ledc_timer_bit_t=int;
constexpr int LEDC_HIGH_SPEED_MODE=0, LEDC_LOW_SPEED_MODE=1, LEDC_CHANNEL_0=0, LEDC_TIMER_0=0;
constexpr int LEDC_TIMER_8_BIT=8, LEDC_TIMER_10_BIT=10, LEDC_TIMER_16_BIT=16, LEDC_AUTO_CLK=0, LEDC_USE_APB_CLK=1;
struct ledc_timer_config_t { int speed_mode, timer_num, duty_resolution; uint32_t freq_hz; int clk_cfg; };
struct ledc_channel_config_t { int gpio_num, speed_mode, channel, timer_sel; uint32_t duty; };
ledc_timer_config_t timers[2][4] = {};
uint32_t duties[2][8] = {};
int ledc_timer_config(const ledc_timer_config_t* config) {
  // ESP32 APB divider must be 1..1023.996; reject impossible frequency/resolution pairs.
  double divider = 80000000.0 / (config->freq_hz * (1U << config->duty_resolution));
  assert(divider >= 1.0 && divider < 1024.0);
  timers[config->speed_mode][config->timer_num] = *config; return ESP_OK;
}
int ledc_channel_config(const ledc_channel_config_t* config) { duties[config->speed_mode][config->channel] = config->duty; return ESP_OK; }
int ledc_set_duty(int bank, int channel, uint32_t duty) { duties[bank][channel] = duty; return ESP_OK; }
int ledc_update_duty(int, int) { return ESP_OK; }
using adc_unit_t=int; using adc_channel_t=int; using adc_oneshot_unit_handle_t=void*;
constexpr int ADC_ATTEN_DB_12=12, ADC_BITWIDTH_12=12;
struct adc_oneshot_unit_init_cfg_t { int unit_id; };
struct adc_oneshot_chan_cfg_t { int atten, bitwidth; };
bool adcFails=false;
int adc_oneshot_io_to_channel(int pin, int* unit, int* channel) { *unit=0; *channel=pin % 8; return ESP_OK; }
int adc_oneshot_new_unit(const adc_oneshot_unit_init_cfg_t*, void** unit) { *unit=(void*)1; return ESP_OK; }
int adc_oneshot_config_channel(void*, int, const adc_oneshot_chan_cfg_t* config) { assert(config->atten==12 && config->bitwidth==12); return ESP_OK; }
int adc_oneshot_read(void*, int, int* raw) { *raw=2048; return adcFails ? 1 : ESP_OK; }
using esp_event_base_t=int;
constexpr int WIFI_EVENT=1, IP_EVENT=2, IP_EVENT_STA_GOT_IP=3, WIFI_EVENT_STA_DISCONNECTED=4, ESP_EVENT_ANY_ID=-1;
constexpr int WIFI_STORAGE_RAM=0, WIFI_AUTH_WPA2_PSK=2, WIFI_AUTH_OPEN=0, WIFI_MODE_STA=1, WIFI_IF_STA=0;
struct wifi_init_config_t {};
#define WIFI_INIT_CONFIG_DEFAULT() wifi_init_config_t{}
struct wifi_config_t { struct { uint8_t ssid[32], password[64]; struct { int authmode; } threshold; } sta; };
int wifiConnects=0, wifiStorage=-1, wifiConnectError=0;
int nvs_flash_init() { return ESP_OK; }
int esp_netif_init() { return ESP_OK; }
int esp_event_loop_create_default() { return ESP_OK; }
void* esp_netif_create_default_wifi_sta() { return (void*)1; }
int esp_wifi_init(wifi_init_config_t*) { return ESP_OK; }
int esp_wifi_set_storage(int storage) { wifiStorage=storage; return ESP_OK; }
int esp_event_handler_register(int, int, void(*)(void*, int, int32_t, void*), void*) { return ESP_OK; }
int esp_wifi_set_mode(int) { return ESP_OK; }
int esp_wifi_set_config(int, wifi_config_t*) { return ESP_OK; }
int esp_wifi_start() { return ESP_OK; }
int esp_wifi_connect() { ++wifiConnects; return wifiConnectError; }
#define CAPI_WIFI_SSID "TEST"
#define CAPI_WIFI_PASSWORD ""
bool busFails=false, probeFails=false;
int transfers=0, probes=0;
std::vector<std::vector<uint8_t>> busBytes;
using i2c_master_bus_handle_t=void*; using i2c_master_dev_handle_t=void*;
constexpr int I2C_NUM_0=0, I2C_CLK_SRC_DEFAULT=0, I2C_ADDR_BIT_LEN_7=7;
struct i2c_master_bus_config_t { int i2c_port, sda_io_num, scl_io_num, clk_source, glitch_ignore_cnt; struct { bool enable_internal_pullup; } flags; };
struct i2c_device_config_t { int dev_addr_length, device_address, scl_speed_hz; };
int i2c_new_master_bus(const i2c_master_bus_config_t*, void** bus) { *bus=(void*)1; return ESP_OK; }
int i2c_master_probe(void*, int, int timeout) { assert(timeout==5); ++probes; return probeFails ? 1 : ESP_OK; }
int i2c_master_bus_add_device(void*, const i2c_device_config_t* config, void** device) { assert(config->scl_speed_hz==100000); *device=(void*)1; return ESP_OK; }
int i2c_master_transmit(void*, const uint8_t* data, size_t count, int timeout) {
  assert(timeout==5 && count<=32); ++transfers; busBytes.emplace_back(data,data+count); return busFails ? 1 : ESP_OK;
}
using spi_device_handle_t=void*;
constexpr int SPI3_HOST=3, SPI_DMA_CH_AUTO=0;
struct spi_transaction_t { size_t length; const void* tx_buffer; };
struct spi_bus_config_t { int mosi_io_num, miso_io_num, sclk_io_num, quadwp_io_num, quadhd_io_num, max_transfer_sz; };
struct spi_device_interface_config_t { int clock_speed_hz, spics_io_num, queue_size, mode; };
spi_transaction_t* pendingTransfer=nullptr;
int spi_bus_initialize(int, const spi_bus_config_t* config, int) { assert(config->max_transfer_sz==1536); return ESP_OK; }
int spi_bus_add_device(int, const spi_device_interface_config_t* config, void** device) { assert(config->queue_size==1); *device=(void*)1; return ESP_OK; }
int spi_device_queue_trans(void*, spi_transaction_t* transaction, int ticks) {
  assert(ticks==20 && !pendingTransfer && transaction->length<=1536*8);
  pendingTransfer=transaction; ++transfers;
  const auto* data=(const uint8_t*)transaction->tx_buffer;
  busBytes.emplace_back(data,data+transaction->length/8); return ESP_OK;
}
int spi_device_get_trans_result(void*, spi_transaction_t** result, int ticks) {
  assert(ticks==20); if (busFails) return 1; *result=pendingTransfer; pendingTransfer=nullptr; return ESP_OK;
}
`;
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'hal.h'), stub);
for (const header of ['freertos/FreeRTOS.h','freertos/task.h','freertos/queue.h','driver/gpio.h','driver/ledc.h','esp_timer.h','esp_idf_version.h','esp_adc/adc_oneshot.h','esp_wifi.h','esp_event.h','esp_netif.h','nvs_flash.h','wifi_config.example.h','driver/i2c_master.h','driver/spi_master.h']) {
  const path = resolve(directory, header); await mkdir(dirname(path), { recursive: true });
  await writeFile(path, '#pragma once\n#include "hal.h"\n');
}
async function run(name, code, checks, args = [[]]) {
  const input = resolve(directory, `${name}.cpp`), output = resolve(directory, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
  await writeFile(input, `${code}\n${checks}`);
  const compile = spawnSync('g++', ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-Wno-unused-parameter', '-I', directory, input, '-o', output], { encoding:'utf8', timeout:60000 });
  assert.equal(compile.status, 0, `${name}: ${compile.error ?? compile.stderr}`);
  for (const values of args) {
    const result = spawnSync(output, values, { encoding:'utf8', timeout:5000 });
    assert.equal(result.status, 0, `${name} ${values}: ${result.error ?? result.stderr}`);
  }
  console.log(`${name}: generated native C++ runtime assertions passed (${args.length} scenarios).`);
}

const fixture = firmwareFixture();
const native = generateEspIdfCodeResult(fixture.program, 'HAL', fixture.scene);
assert.ok(!native.diagnostics.some(item => item.severity === 'error'));
const adc = fixture.scene.devices.find(device => device.kind === 'lightSensor');
await run('runtime', native.code, `
int main() {
  capiHardwareBegin(); assert(wifiStorage==WIFI_STORAGE_RAM);
  capiOutput(1); capiDigitalWrite(1,1); capiOutput(1);
  assert(configurations[1]==1 && levels[1]==1); // repeated writes must not glitch low
  capiInput(38,true); assert(pullups[38]==1);
  for (const auto& pwm : capiPwm) {
    if (pwm.tone) {
      const auto before=std::array<std::array<ledc_timer_config_t,4>,2>{{
        {timers[0][0],timers[0][1],timers[0][2],timers[0][3]},
        {timers[1][0],timers[1][1],timers[1][2],timers[1][3]}}};
      for (uint32_t hz : {20U, 999U, 1000U, 20000U}) {
        capiTone(pwm.pin,hz);
        const auto& timer=timers[pwm.bank][pwm.timer];
        assert(timer.freq_hz==hz && duties[pwm.bank][pwm.channel]==(1U << (timer.duty_resolution-1)));
        for(int b=0;b<2;++b) for(int t=0;t<4;++t) if(b!=pwm.bank || t!=pwm.timer)
          assert(timers[b][t].freq_hz==before[b][t].freq_hz && timers[b][t].duty_resolution==before[b][t].duty_resolution);
      }
      capiTone(pwm.pin,0); assert(duties[pwm.bank][pwm.channel]==0);
    } else { capiPwmWrite(pwm.pin,UINT32_MAX); assert(duties[pwm.bank][pwm.channel]==((1U<<pwm.resolution)-1)); }
  }
  assert(capiAnalogRead(${adc.pins.signal})==2048); adcFails=true;
  assert(capiAnalogRead(${adc.pins.signal})==0); size_t warnings=messages.size();
  assert(capiAnalogRead(${adc.pins.signal})==0 && messages.size()==warnings);
  capiWifiBegin(); capiWifiBegin(); assert(wifiConnects==1);
  capiWifiEvent(nullptr,IP_EVENT,IP_EVENT_STA_GOT_IP,nullptr); assert(capiWifiConnected());
  capiWifiBegin(); assert(wifiConnects==1);
  capiWifiEvent(nullptr,WIFI_EVENT,WIFI_EVENT_STA_DISCONNECTED,nullptr); assert(!capiWifiConnected());
  wifiConnectError=1; capiWifiBegin(); assert(wifiConnects==2 && !capiWifiConnecting);
  testMicros=(int64_t(UINT32_MAX)+2)*1000; assert(capiMillis()==1);
  messages.clear(); for(int i=0;i<32;++i) assert(capiPrintln("full"));
  runThread0(0,32); assert(pc_T0==0 && !active_T1); // no silently dropped Serial instruction
  messages.pop_front(); runThread0(16,32); assert(active_T1 && pc_T0==2);
  assert(messages.size()==32 && strcmp(messages.back(),"Comenzar")==0);
  runThread1(16,32); assert(pc_T1!=0); // full console does not block another path
  assert(addCounter(INT32_MAX,1)==INT32_MAX && addCounter(INT32_MIN,-1)==INT32_MIN);
}
`);

const auxiliary = firmwareFixture(true);
await run('fork-join', generateEspIdfCodeResult(auxiliary.program, 'Join', auxiliary.scene).code, `
int main() {
  stopAtMicros=1000000;
  try { app_main(); } catch(const TestStop&) {} // run the actual scheduler and timed buzzer service
  assert(!active_T0 && !active_T1 && !active_T2);
  assert(messages.size()==2 && strcmp(messages.front(),"Comenzar")==0 && strcmp(messages.back(),"Todos terminaron")==0);
  assert(messageTimes[1]>=100000); // parent cannot cross join before the motor wait
  for(const auto& pwm:capiPwm) if(!pwm.tone) assert(duties[pwm.bank][pwm.channel]==0);
  assert(levels[18]==1);
}
`);

for (const profile of Object.keys(displayProfiles)) {
  const {scene} = addDeviceToScene(createEmptyScene('HAL display'), 'display', {config:displayConfig(profile)});
  const code = generateEspIdfCodeResult({version:2,threads:[{id:'start',startBlockId:'start',nodes:[]}]}, 'Display', scene).code;
  const i2c = displayProfiles[profile].bus === 'i2c';
  await run(profile, code, `
uint32_t clockMs=2;
void service() { capiDisplayService(clockMs); clockMs+=2; }
void flush() {
  for(int i=0;i<CAPI_DISPLAY_CELLS+1;++i) service();
  assert(memcmp(capiDisplayWanted,capiDisplaySent,CAPI_DISPLAY_CELLS)==0);
}
int main(int argc, char**) {
  capiHardwareBegin();
  if(argc>1) {
    ${i2c ? 'probeFails=true;' : 'busFails=true;'}
    capiDisplayBegin(); assert(!capiDisplayReady);
    int attempts=transfers+probes; capiDisplayWrite(0,0,1,1,"A");
    for(int i=0;i<100;++i) service();
    assert(transfers+probes==attempts); return 0;
  }
  capiDisplayBegin(); assert(capiDisplayReady);
  ${i2c ? '' : `
  auto sentRegister=[](uint8_t command, std::vector<uint8_t> values) {
    for(size_t i=0;i+1<busBytes.size();++i) if(busBytes[i]==std::vector<uint8_t>{command} && busBytes[i+1]==values) return true;
    return false;
  };
  assert(sentRegister(0xc0,${profile === 'ili9341' ? '{0x10}' : '{0x17,0x15}'}));
  assert(sentRegister(0x3a,${profile === 'ili9341' ? '{0x55}' : '{0x66}'}));
  assert(sentRegister(0x36,{0x28}));
  `}
  capiDisplayWrite(0,0,3,1,"OLD"); capiDisplayWrite(0,0,3,1,"NEW");
  capiDisplayWrite(0,1,4,1,"KEEP");
  int before=transfers; service(); assert(transfers-before<=${i2c ? 2 : 6});
  assert(capiDisplaySent[0]=='N' && capiDisplaySent[1]==' '); // one cell per tick
  flush(); assert(memcmp(capiDisplaySent,"NEW",3)==0);
  assert(memcmp(capiDisplaySent+CAPI_DISPLAY_COLUMNS,"KEEP",4)==0);
  before=transfers; for(int i=0;i<100;++i) service(); assert(transfers==before);
  capiDisplayWrite(0,0,3,1,nullptr); flush();
  assert(memcmp(capiDisplaySent,"   ",3)==0 && memcmp(capiDisplaySent+CAPI_DISPLAY_COLUMNS,"KEEP",4)==0);
  capiDisplayWrite(CAPI_DISPLAY_COLUMNS-1,CAPI_DISPLAY_ROWS-1,1,1,"Z"); flush();
  assert(capiDisplaySent[CAPI_DISPLAY_CELLS-1]=='Z');
  before=transfers; capiDisplayWrite(CAPI_DISPLAY_COLUMNS,0,1,1,"X"); flush(); assert(transfers==before);
  busFails=true; capiDisplayWrite(0,0,1,1,"X"); service(); assert(!capiDisplayReady);
  ${i2c ? '' : 'assert(pendingTransfer==&capiDisplayTransaction); const auto pending=capiDisplayTransaction; uint8_t saved[1536]; memcpy(saved,capiDisplayTransferBytes,1536);'}
  before=transfers; for(int i=0;i<100;++i) service(); assert(transfers==before);
  ${i2c ? '' : 'assert(capiDisplayTransaction.tx_buffer==pending.tx_buffer && capiDisplayTransaction.length==pending.length); assert(memcmp(saved,capiDisplayTransferBytes,1536)==0);'}
}
`, [[], ['missing']]);
}
