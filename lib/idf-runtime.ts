import type { SceneDefinition } from './scene-model.ts';

export const IDF_VERSION = '5.5.5';
export const IDF_IMAGE = 'espressif/idf:v5.5.5@sha256:a9231d0697ab8f7517cc072e93b7c83e04907bfbfba80b6440d7dbbf90665cf2';
export type PwmAssignment = { pin: number; bank: number; channel: number; timer: number; frequency: number; resolution: number; tone: boolean };

/** ESP32 has two banks of eight channels / four timers. Never share a tone timer. */
export function allocateIdfPwm(scene: SceneDefinition): PwmAssignment[] | null {
  const groups = new Map<string, { pins: number[]; frequency: number; resolution: number; tone: boolean }>();
  for (const device of scene.devices) {
    let pins: (number | null)[] = [], frequency = 0, resolution = 8;
    switch (device.kind) {
      case 'robot': pins = Object.values(device.pins); frequency = 20000; break;
      case 'motor': pins = Object.values(device.pins); frequency = 20000; break;
      case 'led': pins = [device.pins.signal]; frequency = 5000; break;
      case 'servo': pins = [device.pins.signal]; frequency = 50; resolution = 16; break;
      case 'activeBuzzer': pins = [device.pins.signal]; frequency = 1000; break;
      case 'passiveBuzzer': pins = [device.pins.signal]; frequency = 1100; break;
    }
    if (!pins.length) continue;
    const tone = device.kind === 'passiveBuzzer';
    const key = tone ? `tone:${device.id}` : `${frequency}:${resolution}`;
    const group = groups.get(key) ?? { pins: [], frequency, resolution, tone };
    group.pins.push(...pins.filter((pin): pin is number => pin !== null));
    groups.set(key, group);
  }
  const values = [...groups.values()].filter(group => group.pins.length).sort((a, b) => b.pins.length - a.pins.length);
  if (values.reduce((count, group) => count + group.pins.length, 0) > 16) return null;
  const search = (index: number, channels: number[], timers: number[], output: PwmAssignment[]): PwmAssignment[] | null => {
    if (index === values.length) return output;
    const group = values[index];
    for (let high = Math.min(group.pins.length, 8 - channels[0]); high >= 0; high--) {
      const counts = [high, group.pins.length - high];
      if (counts.some((count, bank) => count + channels[bank] > 8 || (count > 0 && timers[bank] >= 4))) continue;
      const assigned = group.pins.map((pin, offset) => {
        const bank = offset < high ? 0 : 1;
        return { pin, bank, channel: channels[bank] + offset - (bank ? high : 0), timer: timers[bank], frequency: group.frequency, resolution: group.resolution, tone: group.tone };
      });
      const found = search(index + 1, channels.map((count, bank) => count + counts[bank]), timers.map((count, bank) => count + Number(counts[bank] > 0)), [...output, ...assigned]);
      if (found) return found;
    }
    return null;
  };
  return search(0, [0, 0], [0, 0], []);
}

export function idfRuntimeSupport(scene: SceneDefinition, usesWifi: boolean) {
  const assignments = allocateIdfPwm(scene) ?? [];
  const hasAdc = scene.devices.some(device => device.kind === 'lightSensor' || device.kind === 'potentiometer');
  const setup: string[] = [];
  for (const device of scene.devices) {
    if (device.kind === 'trafficLight') for (const pin of Object.values(device.pins)) setup.push(`  capiOutput(${pin ?? 255});`);
    if (device.kind === 'button') setup.push(`  capiInput(${device.pins.signal ?? 255}, ${device.config.pullup});`);
    if (device.kind === 'lightSensor' || device.kind === 'potentiometer') setup.push(`  capiAdcConfigure(${device.pins.signal ?? 255});`);
  }
  return `// ESP-IDF ${IDF_VERSION}, native APIs only. No Arduino runtime.
#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "esp_timer.h"
#include "esp_idf_version.h"
#if ESP_IDF_VERSION != ESP_IDF_VERSION_VAL(5, 5, 5) || !CONFIG_IDF_TARGET_ESP32
#error "This project requires ESP-IDF 5.5.5 and target esp32 (Wemos D1 R32)."
#endif
${hasAdc ? '#include "esp_adc/adc_oneshot.h"' : ''}
${usesWifi ? '#include "esp_wifi.h"\n#include "esp_event.h"\n#include "esp_netif.h"\n#include "nvs_flash.h"\n#if __has_include("wifi_config.h")\n#include "wifi_config.h"\n#else\n#include "wifi_config.example.h"\n#endif' : ''}

uint32_t capiMillis() { return (uint32_t)(esp_timer_get_time() / 1000); }
// Constant source strings live for the entire program. Queue stores pointers, not copies.
QueueHandle_t capiConsoleQueue = nullptr;
bool capiPrintln(const char* message) { return capiConsoleQueue && xQueueSend(capiConsoleQueue, &message, 0) == pdTRUE; }
void capiConsoleTask(void*) {
  const char* message;
  for (;;) if (xQueueReceive(capiConsoleQueue, &message, portMAX_DELAY) == pdTRUE) { fputs(message, stdout); fputc('\\n', stdout); fflush(stdout); }
}
void capiOutput(uint8_t pin) {
  static bool configured[40] = {};
  if (pin >= 40) abort();
  if (configured[pin]) return;
  gpio_config_t config = {};
  config.pin_bit_mask = 1ULL << pin; config.mode = GPIO_MODE_OUTPUT;
  ESP_ERROR_CHECK(gpio_set_level((gpio_num_t)pin, 0));
  ESP_ERROR_CHECK(gpio_config(&config));
  configured[pin] = true;
}
void capiInput(uint8_t pin, bool pullup) {
  gpio_config_t config = {};
  config.pin_bit_mask = 1ULL << pin; config.mode = GPIO_MODE_INPUT;
  config.pull_up_en = pullup ? GPIO_PULLUP_ENABLE : GPIO_PULLUP_DISABLE;
  ESP_ERROR_CHECK(gpio_config(&config));
}
void capiDigitalWrite(uint8_t pin, int level) { ESP_ERROR_CHECK(gpio_set_level((gpio_num_t)pin, level)); }
int capiDigitalRead(uint8_t pin) { return gpio_get_level((gpio_num_t)pin); }

struct CapiPwm { uint8_t pin; ledc_mode_t bank; ledc_channel_t channel; ledc_timer_t timer; ledc_timer_bit_t resolution; uint32_t frequency; bool tone; };
constexpr CapiPwm capiPwm[] = {
${assignments.length ? assignments.map(item => `  { ${item.pin}, ${item.bank ? 'LEDC_LOW_SPEED_MODE' : 'LEDC_HIGH_SPEED_MODE'}, (ledc_channel_t)${item.channel}, (ledc_timer_t)${item.timer}, (ledc_timer_bit_t)${item.resolution}, ${item.frequency}, ${item.tone} },`).join('\n') : '  { 255, LEDC_HIGH_SPEED_MODE, LEDC_CHANNEL_0, LEDC_TIMER_0, LEDC_TIMER_8_BIT, 5000, false }, // unused sentinel'}
};
void capiPwmWrite(uint8_t pin, uint32_t duty) {
  for (const auto& pwm : capiPwm) if (pwm.pin == pin && pin != 255) {
    duty = std::min<uint32_t>(duty, (1U << pwm.resolution) - 1);
    ESP_ERROR_CHECK(ledc_set_duty(pwm.bank, pwm.channel, duty));
    ESP_ERROR_CHECK(ledc_update_duty(pwm.bank, pwm.channel)); return;
  }
}
void capiTone(uint8_t pin, uint32_t frequency) {
  for (const auto& pwm : capiPwm) if (pwm.pin == pin && pin != 255 && pwm.tone) {
    if (!frequency) { capiPwmWrite(pin, 0); return; }
    // A fixed 8-bit/APB timer cannot reach the entire 20..20000 Hz repertoire.
    // This timer belongs only to this buzzer, so changing resolution is isolated.
    const ledc_timer_bit_t resolution = frequency < 1000 ? LEDC_TIMER_16_BIT : LEDC_TIMER_10_BIT;
    ledc_timer_config_t timer = {}; timer.speed_mode = pwm.bank; timer.timer_num = pwm.timer;
    timer.duty_resolution = resolution; timer.freq_hz = frequency; timer.clk_cfg = LEDC_USE_APB_CLK;
    ESP_ERROR_CHECK(ledc_timer_config(&timer));
    ESP_ERROR_CHECK(ledc_set_duty(pwm.bank, pwm.channel, 1U << (resolution - 1)));
    ESP_ERROR_CHECK(ledc_update_duty(pwm.bank, pwm.channel)); return;
  }
}
${hasAdc ? `
adc_oneshot_unit_handle_t capiAdcUnits[2] = {};
void capiAdcConfigure(uint8_t pin) {
  adc_unit_t unit; adc_channel_t channel;
  ESP_ERROR_CHECK(adc_oneshot_io_to_channel(pin, &unit, &channel));
  if (!capiAdcUnits[unit]) {
    adc_oneshot_unit_init_cfg_t config = {}; config.unit_id = unit;
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&config, &capiAdcUnits[unit]));
  }
  adc_oneshot_chan_cfg_t config = {}; config.atten = ADC_ATTEN_DB_12; config.bitwidth = ADC_BITWIDTH_12;
  ESP_ERROR_CHECK(adc_oneshot_config_channel(capiAdcUnits[unit], channel, &config));
}
int capiAnalogRead(uint8_t pin) {
  adc_unit_t unit; adc_channel_t channel; int raw = 0;
  if (adc_oneshot_io_to_channel(pin, &unit, &channel) != ESP_OK || !capiAdcUnits[unit]) return 0;
  if (adc_oneshot_read(capiAdcUnits[unit], channel, &raw) != ESP_OK) { static bool warned = false; if (!warned) { capiPrintln("[ADC] Lectura no disponible; revisar conexiones."); warned = true; } return 0; }
  return raw;
}
` : ''}
${usesWifi ? `
std::atomic<bool> capiWifiHasIp{false};
std::atomic<bool> capiWifiConnecting{false};
bool capiWifiReady = false;
bool capiWifiConnected() { return capiWifiHasIp.load(); }
void capiWifiEvent(void*, esp_event_base_t base, int32_t id, void*) {
  if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) { capiWifiHasIp = true; capiWifiConnecting = false; }
  if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) { capiWifiHasIp = false; capiWifiConnecting = false; }
}
void capiWifiInit() {
  // Never erase NVS to recover a failed init. Wi-Fi credentials are stored in RAM.
  if (nvs_flash_init() != ESP_OK) { capiPrintln("[Wi-Fi] NVS no disponible; no se borro ninguna configuracion."); return; }
  ESP_ERROR_CHECK(esp_netif_init()); ESP_ERROR_CHECK(esp_event_loop_create_default());
  if (!esp_netif_create_default_wifi_sta()) return;
  wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT(); ESP_ERROR_CHECK(esp_wifi_init(&init));
  ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
  ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, capiWifiEvent, nullptr));
  ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, capiWifiEvent, nullptr));
  wifi_config_t config = {};
  static_assert(sizeof(CAPI_WIFI_SSID) - 1 <= 32, "SSID: maximo 32 bytes");
  static_assert(sizeof(CAPI_WIFI_PASSWORD) - 1 <= 64, "Clave: maximo 64 bytes");
  memcpy(config.sta.ssid, CAPI_WIFI_SSID, sizeof(CAPI_WIFI_SSID) - 1);
  memcpy(config.sta.password, CAPI_WIFI_PASSWORD, sizeof(CAPI_WIFI_PASSWORD) - 1);
  config.sta.threshold.authmode = sizeof(CAPI_WIFI_PASSWORD) > 1 ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA)); ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &config));
  ESP_ERROR_CHECK(esp_wifi_start()); capiWifiReady = true;
}
void capiWifiBegin() {
  if (!capiWifiReady || capiWifiConnected() || capiWifiConnecting.exchange(true)) return;
  if (esp_wifi_connect() != ESP_OK) capiWifiConnecting = false;
}
` : ''}
void capiHardwareBegin() {
  capiConsoleQueue = xQueueCreate(32, sizeof(const char*));
  if (!capiConsoleQueue || xTaskCreate(capiConsoleTask, "capi-console", 4096, nullptr, 1, nullptr) != pdPASS) abort();
  bool timers[2][4] = {};
  for (const auto& pwm : capiPwm) if (pwm.pin != 255) {
    if (!timers[pwm.bank][pwm.timer]) {
      ledc_timer_config_t timer = {}; timer.speed_mode = pwm.bank; timer.timer_num = pwm.timer;
      timer.duty_resolution = pwm.resolution; timer.freq_hz = pwm.frequency; timer.clk_cfg = LEDC_AUTO_CLK;
      ESP_ERROR_CHECK(ledc_timer_config(&timer)); timers[pwm.bank][pwm.timer] = true;
    }
    ledc_channel_config_t channel = {}; channel.gpio_num = pwm.pin; channel.speed_mode = pwm.bank;
    channel.channel = pwm.channel; channel.timer_sel = pwm.timer; channel.duty = 0;
    ESP_ERROR_CHECK(ledc_channel_config(&channel));
  }
${setup.join('\n')}
${usesWifi ? '  capiWifiInit();' : ''}
}
`;
}
