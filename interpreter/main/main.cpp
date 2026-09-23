#include <algorithm>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <iterator>
#include <atomic>
#include <string>
#include <vector>
#include "cJSON.h"
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "driver/uart.h"
#include "esp_system.h"
#include "esp_partition.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mbedtls/base64.h"
#include "nvs.h"
#include "nvs_flash.h"

#ifndef CAPI_BOARD_ID
#define CAPI_BOARD_ID "wemos-d1-r32"
#endif
#define CAPI_FIRMWARE_VERSION "1.0.0"
static constexpr uint16_t ABI = 1;
static constexpr size_t MAX_RULES = 32 * 1024;
static constexpr uart_port_t LINK = UART_NUM_0;

static std::vector<uint8_t> candidate;
static size_t expected_bytes = 0;
static uint32_t expected_crc = 0;
static cJSON *active = nullptr;
static volatile bool running = false, paused = false;
static std::atomic<int> active_tasks{0};
static int32_t counter_value = 0;
static int pwm_pins[8] = {-1,-1,-1,-1,-1,-1,-1,-1};
static int output_pins[32] = {-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1};
static bool pwm_ready = false;

static uint32_t crc32(const uint8_t *data, size_t size) {
  uint32_t value = 0xffffffff;
  for (size_t i = 0; i < size; ++i) { value ^= data[i]; for (int bit = 0; bit < 8; ++bit) value = (value >> 1) ^ (0xedb88320u & -(int32_t)(value & 1)); }
  return value ^ 0xffffffff;
}
static uint16_t u16(const uint8_t *p) { return p[0] | ((uint16_t)p[1] << 8); }
static uint32_t u32(const uint8_t *p) { return p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); }
static void send_json(cJSON *value) { char *line = cJSON_PrintUnformatted(value); if (line) { uart_write_bytes(LINK, line, strlen(line)); uart_write_bytes(LINK, "\n", 1); free(line); } cJSON_Delete(value); }
static void reply(const char *type, const char *message = nullptr) { cJSON *out = cJSON_CreateObject(); cJSON_AddStringToObject(out, "type", type); if (message) cJSON_AddStringToObject(out, "message", message); send_json(out); }
static void telemetry(const char *event, const char *block, const char *message) { cJSON *out = cJSON_CreateObject(); cJSON_AddStringToObject(out, "type", "TELEMETRY"); cJSON_AddStringToObject(out, "event", event); if (block) cJSON_AddStringToObject(out, "blockId", block); if (message) cJSON_AddStringToObject(out, "message", message); send_json(out); }
static const char *text(cJSON *object, const char *key, const char *fallback = "") { cJSON *item = cJSON_GetObjectItemCaseSensitive(object, key); return cJSON_IsString(item) && item->valuestring ? item->valuestring : fallback; }
static int number(cJSON *object, const char *key, int fallback = 0) { cJSON *item = cJSON_GetObjectItemCaseSensitive(object, key); return cJSON_IsNumber(item) ? item->valueint : fallback; }
static cJSON *device(const char *id) {
  cJSON *resources = cJSON_GetObjectItem(active, "resources"), *devices = resources ? cJSON_GetObjectItem(resources, "devices") : nullptr, *item;
  cJSON_ArrayForEach(item, devices) if (!strcmp(text(item, "id"), id)) return item;
  return nullptr;
}
static int pin(cJSON *dev, const char *key) { cJSON *pins = dev ? cJSON_GetObjectItem(dev, "pins") : nullptr; cJSON *item = pins ? cJSON_GetObjectItem(pins, key) : nullptr; return cJSON_IsNumber(item) ? item->valueint : -1; }
static void output(int gpio, int level) { if (gpio < 0 || gpio >= GPIO_NUM_MAX) return; for(int i=0;i<32;++i){if(output_pins[i]==gpio)break;if(output_pins[i]<0){output_pins[i]=gpio;break;}} gpio_reset_pin((gpio_num_t)gpio); gpio_set_direction((gpio_num_t)gpio, GPIO_MODE_OUTPUT); gpio_set_level((gpio_num_t)gpio, level); }
static void safe_outputs() { for(int i=0;i<8;++i)if(pwm_pins[i]>=0){ledc_set_duty(LEDC_LOW_SPEED_MODE,(ledc_channel_t)i,0);ledc_update_duty(LEDC_LOW_SPEED_MODE,(ledc_channel_t)i);} for(int gpio:output_pins)if(gpio>=0)gpio_set_level((gpio_num_t)gpio,0); }
static bool pwm(int gpio, int percent) {
  if(gpio<0||gpio>=GPIO_NUM_MAX)return false; if(!pwm_ready){ledc_timer_config_t timer={};timer.speed_mode=LEDC_LOW_SPEED_MODE;timer.duty_resolution=LEDC_TIMER_8_BIT;timer.timer_num=LEDC_TIMER_0;timer.freq_hz=5000;timer.clk_cfg=LEDC_AUTO_CLK;if(ledc_timer_config(&timer)!=ESP_OK)return false;pwm_ready=true;}
  int channel=-1;for(int i=0;i<8;++i)if(pwm_pins[i]==gpio){channel=i;break;}else if(channel<0&&pwm_pins[i]<0)channel=i;if(channel<0)return false;
  if(pwm_pins[channel]<0){ledc_channel_config_t config={};config.gpio_num=gpio;config.speed_mode=LEDC_LOW_SPEED_MODE;config.channel=(ledc_channel_t)channel;config.intr_type=LEDC_INTR_DISABLE;config.timer_sel=LEDC_TIMER_0;config.duty=0;config.hpoint=0;if(ledc_channel_config(&config)!=ESP_OK)return false;pwm_pins[channel]=gpio;}
  uint32_t duty=(uint32_t)std::clamp(percent,0,100)*255/100;return ledc_set_duty(LEDC_LOW_SPEED_MODE,(ledc_channel_t)channel,duty)==ESP_OK&&ledc_update_duty(LEDC_LOW_SPEED_MODE,(ledc_channel_t)channel)==ESP_OK;
}
static void motor(cJSON *dev, int power, bool robot_side = false, bool right = false) {
  const char *a = robot_side ? (right ? "rightIn1" : "leftIn1") : "in1";
  const char *b = robot_side ? (right ? "rightIn2" : "leftIn2") : "in2";
  pwm(pin(dev, a), power > 0 ? std::abs(power) : 0); pwm(pin(dev, b), power < 0 ? std::abs(power) : 0);
}
static bool allowed_pin(int value) {
  if (value < 0) return true;
  static const int wemos[] = {4,13,14,16,17,18,19,23,25,26,27,34,35,36,39};
  static const int s3[] = {1,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,38,39,40,41,42,47};
  const int *values = !strcmp(CAPI_BOARD_ID,"wemos-d1-r32") ? wemos : s3;
  size_t count = !strcmp(CAPI_BOARD_ID,"wemos-d1-r32") ? sizeof(wemos)/sizeof(*wemos) : sizeof(s3)/sizeof(*s3);
  return std::find(values, values + count, value) != values + count;
}
static bool supported_operation(const char *op) {
  static const char *values[] = {"halt","wait","counterSet","counterChange","pin","led","traffic","motor","robot","serial","repeatStart","repeatNext","jump","jumpIfFalse"};
  return std::find_if(std::begin(values),std::end(values),[op](const char *value){return !strcmp(op,value);}) != std::end(values);
}
static bool validate_rules(const std::vector<uint8_t> &bytes, cJSON **document) {
  if (bytes.size() < 32 || bytes.size() > MAX_RULES || memcmp(bytes.data(), "CAPIRULE", 8) || u16(&bytes[8]) != 1 || u16(&bytes[10]) != ABI || u32(&bytes[12]) != bytes.size() - 32 || u32(&bytes[16]) != crc32(&bytes[32], bytes.size() - 32)) return false;
  std::string payload((const char *)&bytes[32], bytes.size() - 32); cJSON *root = cJSON_ParseWithLength(payload.data(), payload.size());
  cJSON *tasks=root?cJSON_GetObjectItem(root,"tasks"):nullptr,*resources=root?cJSON_GetObjectItem(root,"resources"):nullptr,*devices=resources?cJSON_GetObjectItem(resources,"devices"):nullptr;
  if (!root || strcmp(text(root, "format"), "CapiRules") || strcmp(text(root, "board"), CAPI_BOARD_ID) || number(root, "abi") != ABI || !cJSON_IsArray(tasks) || cJSON_GetArraySize(tasks)>32 || !cJSON_IsArray(devices) || cJSON_GetArraySize(devices)>64 || u32(&bytes[20])>2048 || u32(&bytes[24])!=(uint32_t)cJSON_GetArraySize(devices) || u32(&bytes[28])!=(uint32_t)cJSON_GetArraySize(tasks)) { cJSON_Delete(root); return false; }
  cJSON *item,*pins,*pin_item,*task,*instruction; cJSON_ArrayForEach(item,devices){pins=cJSON_GetObjectItem(item,"pins"); if(!cJSON_IsObject(pins)){cJSON_Delete(root);return false;} cJSON_ArrayForEach(pin_item,pins) if(cJSON_IsNumber(pin_item)&&!allowed_pin(pin_item->valueint)){cJSON_Delete(root);return false;}}
  uint32_t instructions=0; cJSON_ArrayForEach(task,tasks){cJSON *output=cJSON_GetObjectItem(task,"output"); if(!cJSON_IsArray(output)){cJSON_Delete(root);return false;} cJSON_ArrayForEach(instruction,output){if(++instructions>2048||!supported_operation(text(instruction,"op"))){cJSON_Delete(root);return false;}}}
  if(instructions!=u32(&bytes[20])){cJSON_Delete(root);return false;}
  *document = root; return true;
}
struct StoredRules { char magic[8]; uint32_t size; uint32_t crc; };
static const esp_partition_t *rules_partition(uint8_t slot) { return esp_partition_find_first(ESP_PARTITION_TYPE_DATA, (esp_partition_subtype_t)(slot ? 0x41 : 0x40), slot ? "rules_b" : "rules_a"); }
static uint8_t active_slot() { nvs_handle_t handle; uint8_t slot=0; if(nvs_open("capi",NVS_READONLY,&handle)==ESP_OK){nvs_get_u8(handle,"slot",&slot);nvs_close(handle);} return slot>1?0:slot; }
static bool persist(const std::vector<uint8_t> &bytes) {
  uint8_t slot=1-active_slot(); const esp_partition_t *partition=rules_partition(slot); if(!partition||bytes.size()+sizeof(StoredRules)>partition->size)return false;
  StoredRules header={{'C','A','P','I','S','T','O','R'},(uint32_t)bytes.size(),crc32(bytes.data(),bytes.size())};
  if(esp_partition_erase_range(partition,0,partition->size)!=ESP_OK||esp_partition_write(partition,0,&header,sizeof(header))!=ESP_OK||esp_partition_write(partition,sizeof(header),bytes.data(),bytes.size())!=ESP_OK)return false;
  std::vector<uint8_t> check(bytes.size()); StoredRules read{}; if(esp_partition_read(partition,0,&read,sizeof(read))!=ESP_OK||esp_partition_read(partition,sizeof(read),check.data(),check.size())!=ESP_OK||memcmp(read.magic,"CAPISTOR",8)||read.size!=bytes.size()||read.crc!=crc32(check.data(),check.size()))return false;
  nvs_handle_t handle; if(nvs_open("capi",NVS_READWRITE,&handle)!=ESP_OK)return false; esp_err_t result=nvs_set_u8(handle,"slot",slot); if(result==ESP_OK)result=nvs_commit(handle); nvs_close(handle); return result==ESP_OK;
}
static bool load_rules() {
  const esp_partition_t *partition=rules_partition(active_slot()); StoredRules header{}; if(!partition||esp_partition_read(partition,0,&header,sizeof(header))!=ESP_OK||memcmp(header.magic,"CAPISTOR",8)||!header.size||header.size>MAX_RULES||header.size+sizeof(header)>partition->size)return false;
  std::vector<uint8_t> bytes(header.size); if(esp_partition_read(partition,sizeof(header),bytes.data(),bytes.size())!=ESP_OK||crc32(bytes.data(),bytes.size())!=header.crc)return false;
  cJSON *parsed=nullptr; if(!validate_rules(bytes,&parsed))return false; cJSON_Delete(active); active=parsed; return true;
}

static bool condition(cJSON *value) {
  const char *kind = text(value, "kind");
  if (!strcmp(kind, "boolean")) return cJSON_IsTrue(cJSON_GetObjectItem(value, "value"));
  if (!strcmp(kind, "counter")) { int right = number(value, "value"), left = counter_value; const char *op = text(value, "operator"); return !strcmp(op,"EQ") ? left==right : !strcmp(op,"NEQ") ? left!=right : !strcmp(op,"LT") ? left<right : !strcmp(op,"LTE") ? left<=right : !strcmp(op,"GT") ? left>right : left>=right; }
  if (!strcmp(kind, "compare")) { int right=number(value,"right"),left=number(value,"left");const char *op=text(value,"operator");return !strcmp(op,"EQ")?left==right:!strcmp(op,"NEQ")?left!=right:!strcmp(op,"LT")?left<right:!strcmp(op,"LTE")?left<=right:!strcmp(op,"GT")?left>right:left>=right; }
  if (!strcmp(kind, "buttonPressed")) { cJSON *dev = device(text(value,"deviceId")); int gpio = pin(dev,"signal"); if (gpio < 0) return false; gpio_set_direction((gpio_num_t)gpio, GPIO_MODE_INPUT); cJSON *config=cJSON_GetObjectItem(dev,"config"); gpio_set_pull_mode((gpio_num_t)gpio,cJSON_IsTrue(config?cJSON_GetObjectItem(config,"pullup"):nullptr)?GPIO_PULLUP_ONLY:GPIO_FLOATING); return gpio_get_level((gpio_num_t)gpio) == 0; }
  return false;
}
static void execute_task(void *parameter) {
  cJSON *task = (cJSON *)parameter, *instructions = cJSON_GetObjectItem(task, "output"); int pc = 0; std::vector<int> loops(32, 0);
  while (running && pc < cJSON_GetArraySize(instructions)) {
    while (paused && running) vTaskDelay(pdMS_TO_TICKS(20)); if (!running) break;
    cJSON *instruction = cJSON_GetArrayItem(instructions, pc), *dev = device(text(instruction,"deviceId")); const char *op = text(instruction,"op"), *block = text(instruction,"blockId",nullptr);
    telemetry("block", block, op);
    if (!strcmp(op,"halt")) break;
    if (!strcmp(op,"wait")) vTaskDelay(pdMS_TO_TICKS(std::max(0, number(instruction,"ms"))));
    else if (!strcmp(op,"counterSet")) counter_value = number(instruction,"value");
    else if (!strcmp(op,"counterChange")) counter_value += number(instruction,"delta");
    else if (!strcmp(op,"pin")) output(number(instruction,"pin",-1), cJSON_IsTrue(cJSON_GetObjectItem(instruction,"value")));
    else if (!strcmp(op,"led")) pwm(pin(dev,"signal"),number(instruction,"brightness"));
    else if (!strcmp(op,"traffic")) { const char *color=text(instruction,"color");cJSON *config=cJSON_GetObjectItem(dev,"config");pwm(pin(dev,"red"),!strcmp(color,"RED")?number(config,"redBrightness",100):0);pwm(pin(dev,"yellow"),!strcmp(color,"YELLOW")?number(config,"yellowBrightness",100):0);pwm(pin(dev,"green"),!strcmp(color,"GREEN")?number(config,"greenBrightness",100):0); }
    else if (!strcmp(op,"motor")) { const char *direction=text(instruction,"direction");int power=number(instruction,"power");motor(dev,!strcmp(direction,"FORWARD")?power:!strcmp(direction,"BACKWARD")?-power:0); }
    else if (!strcmp(op,"robot")) { const char *action=text(instruction,"action");int speed=number(instruction,"speed");int left=!strcmp(action,"BACKWARD")?-speed:!strcmp(action,"LEFT")?-speed:!strcmp(action,"STOP")?0:speed;int right=!strcmp(action,"BACKWARD")?-speed:!strcmp(action,"RIGHT")?-speed:!strcmp(action,"STOP")?0:speed;motor(dev,left,true,false);motor(dev,right,true,true); }
    else if (!strcmp(op,"serial")) telemetry("message",block,text(instruction,"text"));
    else if (!strcmp(op,"repeatStart")) { int slot=number(instruction,"slot"), count=number(instruction,"count"); if (slot>=0&&slot<(int)loops.size()) { if (!loops[slot]) loops[slot]=count; if (loops[slot]<=0) { loops[slot]=0; pc=number(instruction,"end"); continue; } } }
    else if (!strcmp(op,"repeatNext")) { int slot=number(instruction,"slot"); if(slot>=0&&slot<(int)loops.size()&&--loops[slot]>0){pc=number(instruction,"target");continue;} }
    else if (!strcmp(op,"jump")) { pc=number(instruction,"target"); continue; }
    else if (!strcmp(op,"jumpIfFalse") && !condition(cJSON_GetObjectItem(instruction,"condition"))) { pc=number(instruction,"target"); continue; }
    ++pc; taskYIELD();
  }
  telemetry("task-done", text(task,"id"), "Camino terminado"); if(--active_tasks==0){running=false;telemetry("program-done",nullptr,"Programa terminado");} vTaskDelete(nullptr);
}
static bool start_program() { if (!active || running || active_tasks>0) return false; cJSON *tasks=cJSON_GetObjectItem(active,"tasks"), *task; int count=0; cJSON_ArrayForEach(task,tasks) if(cJSON_IsTrue(cJSON_GetObjectItem(task,"initial"))) ++count; if(!count)return false; active_tasks=count; running=true; paused=false; int index=0; cJSON_ArrayForEach(task,tasks) if(cJSON_IsTrue(cJSON_GetObjectItem(task,"initial"))){ char name[16]; snprintf(name,sizeof(name),"capi-%d",index++); if(xTaskCreate(execute_task,name,6144,task,5,nullptr)!=pdPASS)--active_tasks; } if(active_tasks==0)running=false; return running; }

static void command(cJSON *request) {
  const char *type = text(request,"type");
  if (!strcmp(type,"HELLO")) { cJSON *out=cJSON_CreateObject(); cJSON_AddStringToObject(out,"type","HELLO"); cJSON_AddStringToObject(out,"protocol","CapiLink"); cJSON_AddStringToObject(out,"firmware",CAPI_FIRMWARE_VERSION); cJSON_AddNumberToObject(out,"abi",ABI); cJSON_AddStringToObject(out,"board",CAPI_BOARD_ID); cJSON_AddNumberToObject(out,"maxRulesBytes",MAX_RULES); cJSON *caps=cJSON_AddArrayToObject(out,"capabilities"); for(const char *cap:{"core","gpio","led","traffic","motor","robot","counter","serial","digital-input"}) cJSON_AddItemToArray(caps,cJSON_CreateString(cap)); cJSON *resources=cJSON_AddObjectToObject(out,"resources");cJSON_AddNumberToObject(resources,"pwmChannels",8); send_json(out); }
  else if (!strcmp(type,"BEGIN")) { if(running){reply("ERROR","Detené el programa antes de reemplazarlo.");return;} expected_bytes=number(request,"bytes"); const char *sum=text(request,"checksum"); expected_crc=strtoul(sum,nullptr,16); if(!expected_bytes||expected_bytes>MAX_RULES){reply("ERROR","Tamaño de reglas inválido.");return;} candidate.clear(); candidate.reserve(expected_bytes); reply("READY"); }
  else if (!strcmp(type,"CHUNK")) { const char *encoded=text(request,"data"); size_t capacity=strlen(encoded)*3/4+3, written=0, before=candidate.size(); candidate.resize(before+capacity); if(mbedtls_base64_decode(candidate.data()+before,capacity,&written,(const unsigned char*)encoded,strlen(encoded))!=0||before+written>expected_bytes){candidate.clear();reply("ERROR","Fragmento inválido.");return;} candidate.resize(before+written); reply("ACK"); }
  else if (!strcmp(type,"VERIFY")) { cJSON *parsed=nullptr; if(candidate.size()!=expected_bytes||candidate.size()<32||crc32(candidate.data()+32,candidate.size()-32)!=expected_crc||!validate_rules(candidate,&parsed)){reply("ERROR","Las reglas no superaron la verificación.");return;} cJSON_Delete(parsed); reply("VERIFIED"); }
  else if (!strcmp(type,"COMMIT")) { cJSON *parsed=nullptr; if(!validate_rules(candidate,&parsed)||!persist(candidate)){cJSON_Delete(parsed);reply("ERROR","No pudimos guardar las reglas.");return;} running=false; cJSON_Delete(active); active=parsed; candidate.clear(); reply("COMMITTED"); }
  else if (!strcmp(type,"RUN")) { if(start_program()) reply("OK"); else reply("ERROR","No hay reglas o el programa ya está ejecutándose."); }
  else if (!strcmp(type,"PAUSE")) { paused=true; reply("OK"); }
  else if (!strcmp(type,"RESUME")) { paused=false; reply("OK"); }
  else if (!strcmp(type,"STOP")) { running=false; paused=false; for(int attempt=0;active_tasks>0&&attempt<100;++attempt)vTaskDelay(pdMS_TO_TICKS(10)); safe_outputs(); reply(active_tasks==0?"OK":"ERROR",active_tasks==0?nullptr:"No pudimos detener todos los caminos."); }
  else if (!strcmp(type,"RESET_PROGRAM")) { running=false; paused=false; counter_value=0; safe_outputs(); reply("OK"); }
  else reply("ERROR","Comando desconocido.");
}

extern "C" void app_main() {
  nvs_flash_init(); uart_driver_install(LINK,8192,0,0,nullptr,0); uart_config_t config={}; config.baud_rate=115200; config.data_bits=UART_DATA_8_BITS; config.parity=UART_PARITY_DISABLE; config.stop_bits=UART_STOP_BITS_1; config.flow_ctrl=UART_HW_FLOWCTRL_DISABLE; config.source_clk=UART_SCLK_DEFAULT; uart_param_config(LINK,&config); if(load_rules()) start_program();
  std::string line; uint8_t byte;
  for(;;){ if(uart_read_bytes(LINK,&byte,1,pdMS_TO_TICKS(100))!=1) continue; if(byte=='\n'){ if(!line.empty()&&line.size()<32768){ cJSON *request=cJSON_ParseWithLength(line.data(),line.size()); if(request){command(request);cJSON_Delete(request);} else reply("ERROR","Mensaje inválido."); } line.clear(); } else if(byte!='\r'&&line.size()<32768) line.push_back((char)byte); }
}
