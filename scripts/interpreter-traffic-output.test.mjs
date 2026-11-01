import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const source=await readFile('interpreter/main/main.cpp','utf8');
const start=source.indexOf('else if (!strcmp(op,"traffic"))');
const end=source.indexOf('else if (!strcmp(op,"trafficVehicleDisplay"))', start);
// The next branch groups vehicle and pedestrian commands together.
const finish=end<0?source.indexOf('else if (!strcmp(op,"trafficVehicleDisplay")||',start):end;
assert.ok(start>0 && finish>start);
const branch=source.slice(start,finish).replace(/^else if/, 'if');
const helper=source.slice(source.indexOf('static void traffic_output('),source.indexOf('static int ledc_channel('));
const dir='work/traffic-output';await mkdir(dir,{recursive:true});
await writeFile(`${dir}/probe.cpp`, `
#include <cassert>
#include <cstring>
#include <string>
#include <vector>
#include <utility>
struct cJSON{};
struct RuntimeValue{enum{TEXT}kind;std::string text;};
std::string selected;
int pins[4]={25,17,16,26};
int pwm_pins[8]={-1,-1,-1,-1,-1,-1,-1,-1};
using ledc_channel_t=int;using gpio_num_t=int;
constexpr int LEDC_LOW_SPEED_MODE=0,GPIO_MODE_OUTPUT=1;
int stopped=0;
void ledc_stop(int,int,int){++stopped;}
void gpio_reset_pin(int){}
void gpio_set_direction(int,int){}
std::vector<std::pair<int,int>> writes;
const char *text(cJSON*,const char *key){return !strcmp(key,"color")?selected.c_str():"traffic-1";}
int pin(cJSON*,const char *key){return pins[!strcmp(key,"red")?0:!strcmp(key,"yellow")?1:!strcmp(key,"green")?2:3];}
cJSON *cJSON_GetObjectItem(cJSON *p,const char*){return p;}
int number(cJSON*,const char*,int){return 0;}// The actual scene defaults are zero.
void output(int gpio,int duty){writes.push_back({gpio,duty});}
${helper}
void component_set(const char*,const char*,RuntimeValue){}
void apply(){const char *op="traffic";cJSON value,*instruction=&value,*dev=&value;${branch}}
int main(){
 const char *colors[]={"RED","YELLOW","GREEN","OFF"};
 for(int device=0;device<2;++device){
  if(device){pins[0]=23;pins[1]=19;pins[2]=18;pins[3]=5;}
  for(int common:{-1,pins[3]})for(int choice=0;choice<4;++choice){pins[3]=common;selected=colors[choice];writes.clear();apply();assert(writes.size()==(unsigned)(3+(common>=0)+(choice<3)));
   for(int light=0;light<3;++light){assert(writes[light].first==pins[light]);assert(writes[light].second==0);}
   if(common>=0)assert(writes[3]==std::make_pair(common,0));
   if(choice<3)assert(writes.back()==std::make_pair(pins[choice],1));
  }
 }
 pwm_pins[2]=pins[0];traffic_output(pins[0],1);assert(stopped==1&&pwm_pins[2]==-1);
}
`);
const compile=spawnSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',`${dir}/probe.cpp`,'-o',`${dir}/probe.exe`],{encoding:'utf8'});assert.equal(compile.status,0,compile.error?.message||compile.stderr);
const run=spawnSync(`${dir}/probe.exe`,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
console.log('Actual interpreter traffic branch: digital lights, LOW return, off before on, no LEDC allocation, previous PWM detached');
