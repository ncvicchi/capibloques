#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>

struct CapiGorilla {
  int center[8]={90,90,90,90,90,90,90,90};
  int low[8]={70,70,70,70,70,70,70,70}, high[8]={110,110,110,110,110,110,110,110};
  int channel[8]={0,1,2,3,4,5,6,7}; bool reversed[8]={};
  double position[8]={}, from[8]={}, target[8]={};
  bool ready=false,busy=false,error=false; unsigned mask=0; uint32_t started=0,duration=0;
  bool (*write)(int,int)=nullptr;
  bool start(int kind,int index,int a,int b,uint32_t requested,uint32_t now){
    if(busy)return false;
    error=false;
    if(kind==0){ready=true;return true;}
    if(!ready||kind<1||kind>2||index<0||index>(kind==2?3:7)||a<-20||a>20||b<-20||b>20){error=true;return false;}
    unsigned selected=kind==2?(3U<<(index*2)):(1U<<index);
    for(int i=0;i<8;++i){target[i]=position[i];if(selected&(1U<<i))target[i]=(kind==2&&i%2)?b:a;int physical=center[i]+(reversed[i]?-1:1)*(int)target[i];if((selected&(1U<<i))&&(physical<low[i]||physical>high[i])){error=true;return false;}}
    duration=std::clamp<uint32_t>(requested,200,10000);mask=selected;started=now;
    for(int i=0;i<8;++i){from[i]=position[i];duration=std::max(duration,(uint32_t)std::ceil(std::abs(target[i]-from[i])*1000.0/30.0));}
    busy=true;return true;
  }
  bool posture(const int angles[8],uint32_t requested,uint32_t now){
    if(busy)return false;
    error=false;
    if(!ready){error=true;return false;}
    for(int i=0;i<8;++i){
      int physical=center[i]+(reversed[i]?-angles[i]:angles[i]);
      if(angles[i]<-20||angles[i]>20||physical<low[i]||physical>high[i]){error=true;return false;}
    }
    duration=std::clamp<uint32_t>(requested,200,10000);mask=255;started=now;
    for(int i=0;i<8;++i){
      from[i]=position[i];target[i]=angles[i];
      duration=std::max(duration,(uint32_t)std::ceil(std::abs(target[i]-from[i])*1000.0/30.0));
    }
    busy=true;return true;
  }
  void service(uint32_t now){
    if(!busy)return;
    uint32_t elapsed=now-started;double t=std::min(1.0,(double)elapsed/duration);
    for(int i=0;i<8;++i)if(mask&(1U<<i)){
      double value=from[i]+(target[i]-from[i])*t;
      int physical=center[i]+(reversed[i]?-1:1)*(int)std::lround(value);
      if(write&&!write(channel[i],physical)){error=true;ready=false;busy=false;return;}
      position[i]=value;
    }
    if(elapsed>=duration)busy=false;
  }
  void halt(){busy=false;}
};

