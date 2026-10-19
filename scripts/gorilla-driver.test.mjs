import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gorillaCore } from '../lib/gorilla-core.ts';
import { gorillaFirmwareSupport } from '../lib/gorilla-firmware.ts';
import { createSceneFromTemplate } from '../lib/scene-model.ts';
const h = await readFile(
  new URL('../interpreter/main/gorilla_core.h', import.meta.url),
  'utf8',
);
assert.ok(h.includes(gorillaCore.trim()));
const dir = 'work/gorilla-driver';
await mkdir(`${dir}/driver`, { recursive: true });
const scene = createSceneFromTemplate('gorillaBench');
scene.devices[0].config.settings.verified = true;
const prefix = `#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstddef>
#include <cassert>
#include <vector>
std::vector<std::vector<uint8_t>> writes; bool ok=true;
void delayMicroseconds(int){};
using gpio_num_t=int;
constexpr int I2C_NUM_1=1,I2C_CLK_SRC_DEFAULT=0,I2C_ADDR_BIT_LEN_7=0,ESP_OK=0;
using i2c_master_bus_handle_t=void*;using i2c_master_dev_handle_t=void*;
struct i2c_master_bus_config_t{int i2c_port,sda_io_num,scl_io_num,clk_source,glitch_ignore_cnt;struct{bool enable_internal_pullup;}flags;};
struct i2c_device_config_t{int dev_addr_length,device_address,scl_speed_hz;};
int i2c_new_master_bus(i2c_master_bus_config_t*c,void**b){assert(c->i2c_port==1&&c->sda_io_num==18&&c->scl_io_num==19);*b=(void*)1;return 0;}
int i2c_master_bus_add_device(void*,i2c_device_config_t*c,void**d){assert(c->device_address==64&&c->scl_speed_hz==100000);*d=(void*)2;return 0;}
int i2c_master_transmit(void*,const uint8_t*d,size_t n,int timeout){assert(timeout==5);writes.emplace_back(d,d+n);return ok?0:-1;}
int pdMS_TO_TICKS(int n){return n;}void vTaskDelay(int){}
struct TwoWire{explicit TwoWire(int n){assert(n==1);}bool begin(int a,int b,int rate){assert(a==18&&b==19&&rate==100000);return true;}void setTimeOut(int n){assert(n==5);}void beginTransmission(int a){assert(a==64);}void write(const uint8_t*d,size_t n){writes.emplace_back(d,d+n);}int endTransmission(){return ok?0:1;}};
double S_j0=0,S_j1=0,S_j2=0,S_j3=0,S_j4=0,S_j5=0,S_j6=0,S_j7=0;bool S_ready=false,S_moving=false,S_error=false;
`;
await writeFile(`${dir}/Wire.h`, '#pragma once\n');
await writeFile(`${dir}/driver/i2c_master.h`, '#pragma once\n');
for (const native of [false, true]) {
  const code =
    prefix +
    gorillaFirmwareSupport(
      scene,
      new Map([['gorilla-robot', 'TEST']]),
      native,
      (_, key) => `S_${key}`,
    ) +
    `
int main(){
 assert(!CAPI_GORILLA.start(1,0,10,0,1000,0));assert(writes.empty());
 assert(capiGorillaPrepare());assert(writes.size()==3); // configure only, no channel pulse
 assert(CAPI_GORILLA.start(1,0,10,0,1000,0));assert(!CAPI_GORILLA.start(1,1,10,0,1000,0));
 capiGorillaService(500);assert(S_j0==5&&S_moving);assert(writes.back()[0]==6); // only channel0
 capiGorillaService(1000);assert(S_j0==10&&!S_moving);
 assert(CAPI_GORILLA.start(2,0,-10,10,1000,1000));capiGorillaService(2000);assert(S_j0==-10&&S_j1==10);for(int i=2;i<8;i++)assert(CAPI_GORILLA.position[i]==0);
 int full[8]={0,10,5,-5,8,-8,3,-3};
 assert(CAPI_GORILLA.posture(full,1000,2000));assert(CAPI_GORILLA.mask==255);
 capiGorillaService(2500);assert(S_j0==-5&&S_j1==10&&S_j4==4&&S_j7==-2);
 capiGorillaService(3000);for(int i=0;i<8;i++)assert(CAPI_GORILLA.position[i]==full[i]);
 full[7]=21;assert(!CAPI_GORILLA.posture(full,1000,3000));assert(!CAPI_GORILLA.busy);
 CAPI_GORILLA.position[0]=-10;
 CAPI_GORILLA.low[0]=85;assert(!CAPI_GORILLA.start(1,0,-20,0,1000,2000));assert(CAPI_GORILLA.error);
 CAPI_GORILLA.low[0]=70;assert(CAPI_GORILLA.start(1,0,20,0,200,UINT32_MAX-100));capiGorillaService(899);assert(!S_moving&&S_j0==20); // wrap-safe and rate limited
 assert(CAPI_GORILLA.start(1,0,0,0,1000,1000));ok=false;capiGorillaService(1100);assert(S_error&&!S_ready&&!S_moving);
}`;
  const path = `${dir}/${native ? 'idf' : 'arduino'}.cpp`,
    exe = `${dir}/${native ? 'idf' : 'arduino'}.exe`;
  await writeFile(path, code);
  const result = spawnSync(
    'g++',
    ['-std=c++17', '-Wall', '-Wextra', '-Werror', '-I', dir, path, '-o', exe],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const run = spawnSync(exe, [], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
}

const source = await readFile(
  new URL('../interpreter/main/main.cpp', import.meta.url),
  'utf8',
);
assert.ok(source.includes('values[] = {"gorilla"'), 'falta opcode gorilla');
const validation = source.slice(
  source.indexOf('static bool gorilla_config_valid('),
  source.indexOf('static bool validate_rules('),
);
const runtime = source.slice(
  source.indexOf('static CapiGorilla gorilla;'),
  source.indexOf('static bool condition(cJSON *value)'),
);
const settings = scene.devices[0].config.settings;
const mock = `
#include <map>
#include <string>
#include <cstring>
#include <cstdio>
struct cJSON{enum{OBJECT,ARRAY,NUMBER,STRING,TRUE_VALUE,FALSE_VALUE}type=OBJECT;int valueint=0;double valuedouble=0;std::string str;std::map<std::string,cJSON*> children;cJSON(){}explicit cJSON(int n):type(NUMBER),valueint(n),valuedouble(n){}explicit cJSON(bool b):type(b?TRUE_VALUE:FALSE_VALUE){}explicit cJSON(const char*s):type(STRING),str(s){}};
cJSON* cJSON_GetObjectItem(cJSON*o,const char*k){if(!o)return nullptr;auto it=o->children.find(k);return it==o->children.end()?nullptr:it->second;}
bool cJSON_IsArray(cJSON*v){return v&&v->type==cJSON::ARRAY;}cJSON* cJSON_GetArrayItem(cJSON*v,int i){return cJSON_GetObjectItem(v,std::to_string(i).c_str());}
bool cJSON_IsObject(cJSON*v){return v&&v->type==cJSON::OBJECT;}bool cJSON_IsNumber(cJSON*v){return v&&v->type==cJSON::NUMBER;}bool cJSON_IsTrue(cJSON*v){return v&&v->type==cJSON::TRUE_VALUE;}bool cJSON_IsFalse(cJSON*v){return v&&v->type==cJSON::FALSE_VALUE;}bool cJSON_IsBool(cJSON*v){return cJSON_IsTrue(v)||cJSON_IsFalse(v);}int cJSON_GetArraySize(cJSON*v){return v?(int)v->children.size():0;}
const char*text(cJSON*o,const char*k){auto v=cJSON_GetObjectItem(o,k);return v?v->str.c_str():"";}
int number(cJSON*o,const char*k,int fallback=0){auto v=cJSON_GetObjectItem(o,k);return cJSON_IsNumber(v)?v->valueint:fallback;}
int pin(cJSON*d,const char*k){return number(cJSON_GetObjectItem(d,"pins"),k,-1);}
bool wave=false;bool is_waveshare(){return wave;}bool allowed_output_pin(int n){return n>=0&&n<34;}
using SemaphoreHandle_t=void*;constexpr int pdTRUE=1;int xSemaphoreTake(void*,int){return 1;}void xSemaphoreGive(void*){}
bool running=true,paused=false;int step_owner=-1;uint32_t fake_now=0;int64_t esp_timer_get_time(){return (int64_t)fake_now*1000;}void cooperative_delay_ms(int){}
int i2c_master_bus_rm_device(void*){return 0;}int i2c_del_master_bus(void*){return 0;}
struct RuntimeValue{enum{NUMBER,BOOLEAN}kind=NUMBER;int number=0;bool boolean=false;};std::map<std::string,RuntimeValue> states;void component_set(const char*,const char*k,RuntimeValue v){states[k]=v;}
`;
const interp =
  prefix +
  gorillaCore +
  mock +
  validation +
  runtime +
  `
int main(){
 cJSON dev,config,s,values,pins;dev.children["config"]=&config;dev.children["pins"]=&pins;dev.children["id"]=new cJSON("test");config.children["settings"]=&s;config.children["values"]=&values;config.children["profile"]=new cJSON("GORILLA_PCA9685");
 pins.children["sda"]=new cJSON(18);pins.children["scl"]=new cJSON(19);
 ${Object.entries(settings)
   .map(
     ([k, v]) =>
       `s.children["${k}"]=new cJSON(${typeof v === 'boolean' ? v : Number(v)});`,
   )
   .join('')}
 for(int i=0;i<8;i++)values.children["j"+std::to_string(i)]=new cJSON(0);
 for(const char*k:{"ready","moving","error"})values.children[k]=new cJSON(false);
 assert(gorilla_config_valid(&dev));wave=true;assert(!gorilla_config_valid(&dev));wave=false;
 s.children["verified"]=new cJSON(false);assert(!gorilla_config_valid(&dev));s.children["verified"]=new cJSON(true);
 cJSON instruction;instruction.children["action"]=new cJSON("joint");for(const char*k:{"index","a","b"})instruction.children[k]=new cJSON(0);instruction.children["durationMs"]=new cJSON(1000);assert(gorilla_instruction_valid(&instruction));instruction.children["index"]=new cJSON(8);assert(!gorilla_instruction_valid(&instruction));
 cJSON gait;gait.children["action"]=new cJSON("gait");gait.children["index"]=new cJSON(0);gait.children["a"]=new cJSON(4);gait.children["b"]=new cJSON(2);gait.children["durationMs"]=new cJSON(500);
 assert(gorilla_instruction_valid(&gait));gait.children["a"]=new cJSON(true);assert(!gorilla_instruction_valid(&gait));gait.children["a"]=new cJSON(4);gait.children["index"]=new cJSON(5);assert(!gorilla_instruction_valid(&gait));gait.children["index"]=new cJSON(4);assert(gorilla_instruction_valid(&gait));
 cJSON gc;gc.children["stride"]=new cJSON(4);gc.children["height"]=new cJSON(2);gc.children["phaseMs"]=new cJSON(500);gc.children["turnsVerified"]=new cJSON(false);config.children["gait"]=&gc;assert(gorilla_config_valid(&dev));gc.children["turnsVerified"]=new cJSON(1);assert(!gorilla_config_valid(&dev));gc.children["turnsVerified"]=new cJSON(false);
 cJSON pose,angles;angles.type=cJSON::ARRAY;
 pose.children["action"]=new cJSON("posture");pose.children["durationMs"]=new cJSON(1000);pose.children["angles"]=&angles;
 for(int i=0;i<8;i++)angles.children[std::to_string(i)]=new cJSON(i);
 assert(gorilla_instruction_valid(&pose));angles.children["7"]=new cJSON(21);assert(!gorilla_instruction_valid(&pose));angles.children.erase("7");assert(!gorilla_instruction_valid(&pose));
 cJSON kin,zeros;zeros.type=cJSON::ARRAY;
 kin.children["profile"]=new cJSON("gorilla-v3-50-100-46");kin.children["verified"]=new cJSON(true);kin.children["pulseMinUs"]=new cJSON(544);kin.children["pulseMaxUs"]=new cJSON(2400);kin.children["zeroAngles"]=&zeros;for(int i=0;i<8;i++)zeros.children[std::to_string(i)]=new cJSON(90);
 config.children["kinematics"]=&kin;assert(gorilla_config_valid(&dev));kin.children["verified"]=new cJSON(false);assert(!gorilla_config_valid(&dev));kin.children["verified"]=new cJSON(true);
 cJSON pathInstruction,pathPoints,pathPoint;pathInstruction.children["action"]=new cJSON("path");pathInstruction.children["index"]=new cJSON(0);pathInstruction.children["points"]=&pathPoints;pathPoints.type=cJSON::ARRAY;pathPoints.children["0"]=&pathPoint;
 pathPoint.children["forward"]=new cJSON(0);pathPoint.children["up"]=new cJSON(4);pathPoint.children["ms"]=new cJSON(1000);assert(gorilla_instruction_valid(&pathInstruction));pathPoint.children["ms"]=new cJSON(true);assert(!gorilla_instruction_valid(&pathInstruction));pathPoint.children["ms"]=new cJSON(1000);
 gorilla_mutex=(void*)1;gorilla_reset();assert(gorilla_prepare(&dev));assert(writes.size()==3);assert(gorilla.kinematics_verified&&gorilla.pulse_min==544&&gorilla.pulse_max==2400);gorilla_owner=0;assert(gorilla.start(1,0,10,0,1000,0));fake_now=500;gorilla_service();assert(gorilla.position[0]==5);
 paused=true;fake_now=1500;gorilla_service();assert(gorilla.position[0]==5);paused=false;fake_now=2000;gorilla_service();assert(!gorilla.busy&&gorilla.position[0]==10);
 assert(gorilla.start(1,0,-10,0,1000,2000));running=false;fake_now=2100;gorilla_service();assert(!gorilla.busy&&gorilla.position[0]==10);gorilla_reset();
}
`;
await writeFile(`${dir}/interpreter.cpp`, interp);
const compiled = spawnSync(
  'g++',
  [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-I',
    dir,
    `${dir}/interpreter.cpp`,
    '-o',
    `${dir}/interpreter.exe`,
  ],
  { encoding: 'utf8' },
);
assert.equal(compiled.status, 0, compiled.stderr);
const executed = spawnSync(`${dir}/interpreter.exe`, [], { encoding: 'utf8' });
assert.equal(executed.status, 0, executed.stderr);
console.log(
  'GorillaBot intérprete: funciones reales compiladas con HAL, validación/pines, I2C, pausa y parada aprobadas.',
);
console.log(
  'GorillaBot C++: núcleo idéntico, I2C1/PCA9685 Arduino/IDF, no pulsos al preparar, canales, límites, cooperación, fallo de bus y rollover aprobados.',
);
