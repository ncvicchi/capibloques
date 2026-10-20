// Compile the actual HTTP/runtime adapters with a narrow HAL. Not an SDK build.
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir = 'work/gorilla-remote';
await mkdir(dir, { recursive: true });
for (const name of ['esp_http_server.h', 'esp_random.h'])
  await writeFile(dir + '/' + name, '#pragma once\n');
const root = new URL('../interpreter/main/', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);
const source = `
#include <string>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <atomic>
#include <cstdint>
struct cJSON{int valueint;double valuedouble;char *valuestring;};
cJSON *cJSON_GetObjectItem(cJSON*,const char*),*cJSON_GetArrayItem(cJSON*,int),*cJSON_Parse(const char*),*cJSON_ParseWithLength(const char*,size_t),*cJSON_CreateObject(),*cJSON_CreateArray(),*cJSON_Duplicate(cJSON*,bool),*cJSON_AddArrayToObject(cJSON*,const char*),*cJSON_CreateNumber(double),*cJSON_CreateBool(bool);
bool cJSON_IsObject(cJSON*),cJSON_IsNumber(cJSON*),cJSON_IsBool(cJSON*),cJSON_IsTrue(cJSON*);int cJSON_GetArraySize(cJSON*);
void cJSON_Delete(cJSON*),cJSON_AddStringToObject(cJSON*,const char*,const char*),cJSON_AddNumberToObject(cJSON*,const char*,double),cJSON_AddBoolToObject(cJSON*,const char*,bool),cJSON_AddItemToObject(cJSON*,const char*,cJSON*),cJSON_AddItemToArray(cJSON*,cJSON*),cJSON_ReplaceItemInObject(cJSON*,const char*,cJSON*);char *cJSON_PrintUnformatted(cJSON*);
#define cJSON_ArrayForEach(v,a) for(int ii=0;ii<cJSON_GetArraySize(a)&&((v=cJSON_GetArrayItem(a,ii))!=nullptr);++ii)
using esp_err_t=int;using SemaphoreHandle_t=void*;constexpr int ESP_OK=0,ESP_FAIL=-1,portMAX_DELAY=100,pdTRUE=1;
int xSemaphoreTake(void*,int);void xSemaphoreGive(void*);int64_t esp_timer_get_time();uint32_t esp_random();
using httpd_handle_t=void*;struct httpd_req_t{int content_len;};
struct httpd_config_t{int stack_size,max_open_sockets;bool lru_purge_enable;int recv_wait_timeout,send_wait_timeout;};
#define HTTPD_DEFAULT_CONFIG() httpd_config_t{}
constexpr int HTTP_GET=1,HTTP_POST=2,HTTPD_RESP_USE_STRLEN=-1;
struct httpd_uri_t{const char *uri;int method;esp_err_t(*handler)(httpd_req_t*);};
esp_err_t httpd_req_get_hdr_value_str(httpd_req_t*,const char*,char*,size_t),httpd_resp_set_hdr(httpd_req_t*,const char*,const char*),httpd_resp_set_type(httpd_req_t*,const char*),httpd_resp_send(httpd_req_t*,const char*,int),httpd_resp_sendstr(httpd_req_t*,const char*),httpd_resp_set_status(httpd_req_t*,const char*),httpd_start(httpd_handle_t*,httpd_config_t*),httpd_register_uri_handler(httpd_handle_t,httpd_uri_t*);esp_err_t httpd_stop(httpd_handle_t);size_t httpd_req_get_hdr_value_len(httpd_req_t*,const char*);int httpd_req_recv(httpd_req_t*,char*,int);
const char *text(cJSON*,const char*,const char* = "");int number(cJSON*,const char*,int=0);cJSON*remote_device();std::string remote_nvs(const char*),hardware_id();
#include "${root}remote_http.h"
struct Robot{bool busy,ready,error;double position[8];void halt();bool support(uint32_t);};struct Walker{bool requested;int outcome;void halt();};
static Robot gorilla;inline bool remote_motion_busy(){return gorilla.busy;}static Walker gorilla_walk;static SemaphoreHandle_t gorilla_mutex;static cJSON *active;static bool running,paused,wifi_started,remote_configuring;
bool wifi_connect(),wifi_creates_network(),wifi_provision(const char*,const char*),is_waveshare();
static bool front_sonar_ready;struct Sonar{std::atomic<int> distance;bool fresh(uint32_t);};static Sonar front_sonar;
using gpio_num_t=int;constexpr int GPIO_MODE_INPUT=1,GPIO_PULLUP_ONLY=1,GPIO_FLOATING=0;int pin(cJSON*,const char*),gpio_set_direction(int,int),gpio_set_pull_mode(int,int),gpio_get_level(int);
using nvs_handle_t=int;constexpr int NVS_READWRITE=1;int nvs_open(const char*,int,int*),nvs_set_str(int,const char*,const char*),nvs_erase_key(int,const char*),nvs_commit(int);void nvs_close(int);void send_json(cJSON*);int esp_wifi_stop();
struct esp_netif_t{};struct esp_netif_ip_info_t{struct{uint32_t addr;}ip;};esp_netif_t*esp_netif_get_handle_from_ifkey(const char*);int esp_netif_get_ip_info(esp_netif_t*,esp_netif_ip_info_t*);
#define IPSTR "%d.%d.%d.%d"
#define IP2STR(ip) 1,2,3,4
#include "${root}remote_runtime.h"
`;
await writeFile(dir + '/adapter.cpp', source);
const c = spawnSync(
  'g++',
  [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-Wno-unused-function',
    '-Wno-unused-variable',
    '-fsyntax-only',
    '-I' + dir,
    dir + '/adapter.cpp',
  ],
  { encoding: 'utf8' },
);
assert.equal(c.status, 0, c.stderr);
console.log(
  'Mando62: adaptadores HTTP/runtime reales compilan con HAL y -Wall -Wextra -Werror.',
);

await writeFile(dir+'/guard.cpp',source+`
#include <cassert>
static int supports=0,halts=0;
bool Robot::support(uint32_t){++supports;busy=true;return true;}
void Robot::halt(){++halts;busy=false;}
void Walker::halt(){requested=false;}
int xSemaphoreTake(void*,int){return 1;}void xSemaphoreGive(void*){}
int main(){
 remote_enabled=true;gorilla.busy=gorilla.ready=true;
 assert(remote_control.claim(0,1));assert(remote_control.accept(1,1,0,50,0,0,true,false,1,2,false,false,1));
 assert(remote_control.accept(2,2,1,50,0,0,false,false,2,3,false,false,1));
 remote_guard(100);assert(supports==0&&gorilla.busy);
 remote_guard(502);assert(supports==1&&gorilla_walk.requested&&!remote_control.armed);
 remote_guard(503);assert(supports==1);
 gorilla.busy=false;remote_guard(504);assert(!remote_finishing);
 gorilla.busy=true;remote_control.stopped=true;remote_guard(505);assert(!gorilla.busy&&halts==1);
}
`);
const guard=spawnSync('g++',['-std=c++17','-O2','-Wall','-Wextra','-Werror','-Wno-unused-function','-Wno-unused-variable','-ffunction-sections','-fdata-sections','-Wl,--gc-sections','-I'+dir,dir+'/guard.cpp','-o',dir+'/guard.exe'],{encoding:'utf8'});
assert.equal(guard.status,0,guard.stderr);assert.equal(spawnSync(dir+'/guard.exe').status,0);
console.log('Watchdog real62 con HAL: caducidad inicia apoyo una sola vez sin esperar bloques; STOP mantiene posición y cancela movimiento.');
