#pragma once
#include <cstdint>
// Access credentials and HTTP parsing are outside this bounded state machine.
struct CapiRemote {
  uint32_t sequence=0,ticket=0,issued=0,renewed=0;
  bool connected=false,armed=false,stopped=false;
  int direction=0,rhythm=50,mode=0,mission=0;
  void expire(uint32_t now){if(connected&&(uint32_t)(now-renewed)>=500){connected=armed=false;direction=mission=0;}}
  bool claim(uint32_t now,uint32_t next){expire(now);if(connected||!next)return false;sequence=0;ticket=next;issued=renewed=now;connected=true;armed=false;direction=mission=mode=0;return true;}
  bool accept(uint32_t seq,uint32_t nonce,int dir,int pace,int requested_mode,int requested_mission,bool arm,bool stop,uint32_t now,uint32_t next,bool busy,bool turns,int missions){
    expire(now);
    if(!connected||seq!=sequence+1||seq>0x7fffffff||nonce!=ticket||(uint32_t)(now-issued)>=500||dir<0||dir>4||pace<25||pace>100||requested_mode<0||requested_mode>1||requested_mission<0||requested_mission>missions||(!turns&&dir>2)||(!requested_mode&&requested_mission)||(requested_mode&&dir))return false;
    bool changed=mode!=requested_mode||(direction!=dir&&direction!=0&&dir!=0)||(mission!=requested_mission&&mission!=0&&requested_mission!=0);
    sequence=seq;ticket=next;issued=renewed=now;
    if(stop){stopped=true;armed=false;direction=mission=0;return true;}
    if(arm&&!dir&&!requested_mission&&!busy){stopped=false;armed=true;}
    if(changed||(busy&&!direction&&!mission))armed=false;
    mode=requested_mode;rhythm=pace;direction=armed&&!stopped?dir:0;mission=armed&&!stopped?requested_mission:0;return true;
  }
};
