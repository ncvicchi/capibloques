import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createSceneFromTemplate, addDeviceToScene, createEmptyScene } from '../lib/scene-model.ts';
import { createTrafficPresentation, fitTrafficScene, TRAFFIC_CARD } from '../lib/traffic-presentation.ts';
import { createTrafficWorldState, advanceTrafficWorld } from '../lib/traffic-world.ts';
import { createCapiRules, parseCapiRules } from '../lib/capi-rules.ts';
import { IDF_FONT } from '../lib/idf-font.ts';

let scene=createSceneFromTemplate('intersection');
while(scene.devices.filter(d=>d.kind==='trafficLight').length<4)scene=addDeviceToScene(scene,'trafficLight').scene;
scene.devices.forEach((device,index)=>{device.name=`Semáforo de la esquina ${index+1} cerca de la escuela`;if(device.kind==='trafficLight'){device.config.vehicleDisplay=true;device.config.pedestrianDisplay=true;}});
const before=JSON.stringify(scene),presentation=createTrafficPresentation(scene);
assert.equal(JSON.stringify(scene),before,'layout must not move, rename, or mutate a project');
assert.equal(presentation.labels.length,4,'all four long names must be visible');
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(const label of presentation.labels){
  assert.ok(label.x>=0&&label.y>=0&&label.x+label.width<=960&&label.y+label.height<=540);
  for(const other of presentation.labels)if(label.id!==other.id)assert.equal(overlap(label,other),false,'captions overlap');
  for(const signal of presentation.signals)assert.equal(overlap(label,{x:signal.x-TRAFFIC_CARD.width/2,y:signal.y-TRAFFIC_CARD.height/2,...TRAFFIC_CARD}),false,'caption covers a component');
}
assert.deepEqual(createTrafficPresentation({...scene,devices:[...scene.devices].reverse()}).labels,presentation.labels,'drawing order does not reposition names');
const program={version:2,variables:[],timers:[],threads:[{id:'main',startBlockId:'start',nodes:[{op:'wait',ms:20,blockId:'wait'}]}]};
const bundle=createCapiRules(program,scene,'waveshare-esp32-s3-touch-lcd-5-28117');
assert.deepEqual(bundle.document.presentation,presentation);
assert.ok(bundle.requiredCapabilities.includes('traffic-scene-v1'));
assert.ok(parseCapiRules(bundle.bytes).requiredCapabilities.includes('traffic-scene-v1'));
assert.ok(bundle.bytes.length<16000,`unexpected layout payload growth: ${bundle.bytes.length}`);
assert.equal(createCapiRules(program,createEmptyScene('Sin pantalla'),'wemos-d1-r32').document.presentation,undefined,'physical Wemos does not need display metadata');

mkdirSync('work',{recursive:true});
const source=String.raw`
#include <iostream>
#include <iomanip>
#include "traffic_world.h"
#include "traffic_canvas.h"
#include "font5x7.h"
struct Paint {void rect(int x,int y,int w,int h,uint32_t){if(x<0||y<55||x+w>800||y+h>425)std::abort();}};
int main(){
  std::cout<<std::setprecision(17);Paint p;capi_traffic::Canvas<Paint> canvas(p,CAPI_FONT_5X7,960,540);
  std::cout<<canvas.view.scale<<" "<<canvas.view.x<<" "<<canvas.view.y<<"\n";
  canvas.rect(-100,-100,10,10,0);canvas.rect(1200,900,10,10,0);canvas.circle(-30,270,50,0);canvas.rect(0,0,960,540,0);canvas.text(6,6,"Semaforo 1",0,2);
  capi_traffic::World world;int reset,mask,greenMask;std::array<int,4> walk;
  while(std::cin>>reset>>mask>>greenMask>>walk[0]>>walk[1]>>walk[2]>>walk[3]){
    if(reset)world=capi_traffic::World{};
    std::array<bool,4> enabled,green;for(int i=0;i<4;++i){enabled[i]=mask&(1<<i);green[i]=greenMask&(1<<i);}world.tick(20,green,enabled,walk);
    std::cout<<"{\"collision\":"<<world.collision<<",\"pedCollision\":"<<world.ped_collision<<",\"random\":"<<world.random<<",\"pedRandom\":"<<world.ped_random<<",\"cars\":[";
    bool first=true;for(const auto &car:world.cars){if(!first)std::cout<<",";first=false;std::cout<<"["<<car.id<<","<<car.lane<<","<<car.progress<<","<<car.crashed<<","<<car.waiting<<","<<car.clearing<<"]";}std::cout<<"],\"people\":[";
    first=true;for(const auto &person:world.people){if(!first)std::cout<<",";first=false;std::cout<<"["<<person.id<<","<<person.crossing<<","<<person.direction<<","<<person.progress<<","<<person.started<<"]";}std::cout<<"]}\n";
  }
}`;
writeFileSync('work/traffic-presentation-probe.cpp',source);
const binary=process.platform==='win32'?'work/traffic-presentation-probe.exe':'work/traffic-presentation-probe';
const built=spawnSync(process.env.CXX||'g++',['-std=c++17','-O2','-Wall','-Wextra','-Werror','-Iinterpreter/main','work/traffic-presentation-probe.cpp','-o',binary],{encoding:'utf8'});
assert.equal(built.status,0,built.error?.message||built.stderr);
const lanes=['eastbound','westbound','southbound','northbound'],crossings=['north','east','south','west'];
let world=createTrafficWorldState();const expected=[],input=[];
for(let scenario=0;scenario<6;scenario++)for(let frame=0;frame<1000;frame++){
  if(!frame)world=createTrafficWorldState();
  const mask=scenario===3?(frame<200?1:frame<400?0:15):15;
  const green=scenario===0?0:scenario===1?15:scenario===2?(frame<400?0:3):scenario===3?3:scenario===4?(frame%400<200?3:12):0;
  const walk=crossings.map((_,i)=>scenario<4?-1:((frame+i*100)%500<300?1:0));
  input.push([frame===0?1:0,mask,green,...walk].join(' '));
  world=advanceTrafficWorld(world,Object.fromEntries(lanes.map((lane,i)=>[lane,(green&(1<<i))?'GREEN':frame%2?'YELLOW':'RED'])),20,lanes.filter((_,i)=>mask&(1<<i)),Object.fromEntries(crossings.flatMap((crossing,i)=>walk[i]<0?[]:[[crossing,walk[i]===1?'WALK':'DONT_WALK']])));
  expected.push({collision:!!world.collision,pedCollision:!!world.pedestrianCollision,random:world.randomState,pedRandom:world.pedestrians.randomState,
    cars:world.cars.map(car=>[Number(car.id.split('-').at(-1)),lanes.indexOf(car.lane),car.progress,Number(car.crashed),Number(car.waitingForGreen),Number(car.clearingIntersection)]),
    people:world.pedestrians.people.map(person=>[Number(person.id.split('-').at(-1)),crossings.indexOf(person.crossing),person.direction,person.progress,Number(person.started)])});
}
const result=spawnSync(binary,[],{input:input.join('\n')+'\n',encoding:'utf8',maxBuffer:20*1024*1024});
assert.equal(result.status,0,result.stderr);
const lines=result.stdout.trim().split('\n'),fit=fitTrafficScene(960,540);
lines.shift().split(' ').map(Number).forEach((value,i)=>assert.ok(Math.abs(value-[fit.scale,fit.x,fit.y][i])<1e-10));
assert.equal(lines.length,expected.length);
for(let i=0;i<lines.length;i++){
  const actual=JSON.parse(lines[i]),wanted=expected[i];
  assert.equal(!!actual.collision,wanted.collision,`collision at tick ${i}`);assert.equal(!!actual.pedCollision,wanted.pedCollision,`pedestrian collision at tick ${i}`);
  assert.equal(actual.random,wanted.random);assert.equal(actual.pedRandom,wanted.pedRandom);
  for(const key of ['cars','people']){assert.equal(actual[key].length,wanted[key].length,`${key} at tick ${i}`);for(let j=0;j<actual[key].length;j++)actual[key][j].forEach((value,k)=>assert.ok(Math.abs(value-wanted[key][j][k])<1e-9,`${key} ${j}/${k} at tick ${i}`));}
}
const font=readFileSync('interpreter/main/font5x7.h','utf8').split('CAPI_FONT_5X7[] = {')[1].split('};')[0].match(/0x[0-9a-f]+/g).map(value=>parseInt(value,16));
assert.deepEqual(font,[...IDF_FONT]);
console.log(`Traffic parity: four long captions, ${bundle.bytes.length} bytes, common font/transform, ${expected.length} differential C++/TS ticks passed.`);
