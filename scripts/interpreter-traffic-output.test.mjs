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
int pins[3]={26,25,27};
std::vector<std::pair<int,int>> writes;
const char *text(cJSON*,const char *key){return !strcmp(key,"color")?selected.c_str():"traffic-1";}
int pin(cJSON*,const char *key){return pins[!strcmp(key,"red")?0:!strcmp(key,"yellow")?1:2];}
cJSON *cJSON_GetObjectItem(cJSON *p,const char*){return p;}
int number(cJSON*,const char*,int){return 0;}// The actual scene defaults are zero.
bool pwm(int gpio,int duty){writes.push_back({gpio,duty});return true;}
void component_set(const char*,const char*,RuntimeValue){}
void apply(){const char *op="traffic";cJSON value,*instruction=&value,*dev=&value;${branch}}
int main(){
 const char *colors[]={"RED","YELLOW","GREEN","OFF"};
 for(int device=0;device<2;++device){
  if(device){pins[0]=17;pins[1]=16;pins[2]=23;}
  for(int choice=0;choice<4;++choice){selected=colors[choice];writes.clear();apply();assert(writes.size()==3);
   for(int light=0;light<3;++light){assert(writes[light].first==pins[light]);assert(writes[light].second==(choice==light?100:0));}
  }
 }
}
`);
const compile=spawnSync(process.env.CXX||'g++',['-std=c++17','-Wall','-Wextra','-Werror',`${dir}/probe.cpp`,'-o',`${dir}/probe.exe`],{encoding:'utf8'});assert.equal(compile.status,0,compile.error?.message||compile.stderr);
const run=spawnSync(`${dir}/probe.exe`,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
console.log('Actual interpreter traffic branch: both real pin sets, RED/YELLOW/GREEN/OFF, zero initial brightness -> correct outputs');
