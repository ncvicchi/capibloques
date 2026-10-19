#pragma once
#include <atomic>
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
