/** Own bounded cooperative actuator engine, shared by native exports and interpreter. */
export const gorillaCore = `
struct CapiGorilla {
  int center[8]={90,90,90,90,90,90,90,90};
  int low[8]={70,70,70,70,70,70,70,70}, high[8]={110,110,110,110,110,110,110,110};
  int channel[8]={0,1,2,3,4,5,6,7}; bool reversed[8]={};
  double position[8]={}, from[8]={}, target[8]={};
  bool ready=false,busy=false,error=false; unsigned mask=0; uint32_t started=0,duration=0;
  bool (*write)(int,double)=nullptr;
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

  struct Foot {double x,y;};
  struct Segment {Foot from,to;uint32_t ms;};
  Segment segments[16];int path_count=0,path_leg=0;bool path_active=false,kinematics_verified=false;
  double zero_angles[8]={90,90,90,90,90,90,90,90},pulse_min=1000,pulse_max=2000;
  static constexpr double CAPI_G_PI=3.14159265358979323846;
  bool forward(int leg,double a,double b,Foot &foot)const{
    if(leg<0||leg>3)return false;
    double qa=(zero_angles[2*leg]+a)*CAPI_G_PI/180,qb=(zero_angles[2*leg+1]+b)*CAPI_G_PI/180;
    Foot E{23+50*std::cos(qa),50*std::sin(qa)},F{-23+50*std::cos(qb),50*std::sin(qb)};
    double dx=F.x-E.x,dy=F.y-E.y,d=std::hypot(dx,dy);
    if(!std::isfinite(d)||E.x-F.x<4||E.y<5||F.y<5||d<4||d>=198)return false;
    double h=std::sqrt(10000-d*d/4);
    foot={(E.x+F.x)/2+dy*h/d,(E.y+F.y)/2-dx*h/d};
    double ca=std::abs((E.x-23)*(foot.y-E.y)-E.y*(foot.x-E.x))/5000;
    double cb=std::abs((F.x+23)*(foot.y-F.y)-F.y*(foot.x-F.x))/5000;
    return foot.y>std::max(E.y,F.y)&&ca>=.12&&cb>=.12;
  }
  bool inverse(int leg,Foot foot,double (&out)[2])const{
    if(leg<0||leg>3||!std::isfinite(foot.x)||!std::isfinite(foot.y)||foot.y<=0)return false;
    for(int j=0;j<2;++j){
      double dx=foot.x-(j?-23:23),r=std::hypot(dx,foot.y),c=(r*r+2500-10000)/(100*r);
      if(!std::isfinite(c)||std::abs(c)>=.995)return false;
      double q=(std::atan2(foot.y,dx)+(j?1:-1)*std::acos(c))*180/CAPI_G_PI;
      int i=leg*2+j;out[j]=q-zero_angles[i];
      double physical=center[i]+(reversed[i]?-out[j]:out[j]);
      if(out[j]<-20||out[j]>20||physical<low[i]||physical>high[i])return false;
    }
    Foot check;
    return forward(leg,out[0],out[1],check)&&std::hypot(check.x-foot.x,check.y-foot.y)<.001;
  }
  bool path(int leg,const double (*points)[3],int count,uint32_t now){
    if(busy)return false;
    error=false;
    if(!ready||!kinematics_verified||leg<0||leg>3||count<1||count>16){error=true;return false;}
    Foot home,from;
    if(!forward(leg,0,0,home)||!forward(leg,position[2*leg],position[2*leg+1],from)){error=true;return false;}
    double initial_pair[2];
    if(!inverse(leg,from,initial_pair)||std::abs(initial_pair[0]-position[2*leg])>.001||std::abs(initial_pair[1]-position[2*leg+1])>.001){error=true;return false;}
    uint32_t total=0,requested_total=0;
    for(int n=0;n<count;++n){
      double x=points[n][0],y=points[n][1],ms=points[n][2];
      if(!std::isfinite(x)||!std::isfinite(y)||!std::isfinite(ms)||std::abs(x)>50||std::abs(y)>30||ms<200||ms>10000||ms!=std::floor(ms)){error=true;return false;}
      requested_total+=(uint32_t)ms;
      Foot to{home.x+x,home.y-y};double length=std::hypot(to.x-from.x,to.y-from.y);
      int steps=std::max(16,(int)std::ceil(length/.25));double previous[2],next[2],rate=0;
      if(steps>256||!inverse(leg,from,previous)){error=true;return false;}
      for(int step=1;step<=steps;++step){
        double t=(double)step/steps;
        if(!inverse(leg,{from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t},next)){error=true;return false;}
        for(int j=0;j<2;++j){rate=std::max(rate,std::abs(next[j]-previous[j])*steps*1000/30);previous[j]=next[j];}
      }
      uint32_t effective=std::max((uint32_t)ms,(uint32_t)std::ceil(rate*1.05));
      if(effective>30000){error=true;return false;}
      segments[n]={from,to,effective};total+=effective;from=to;
    }
    if(total>180000||requested_total>120000){error=true;return false;}
    path_leg=leg;path_count=count;path_active=true;duration=total;started=now;mask=3U<<(leg*2);busy=true;return true;
  }
  void path_service(uint32_t now){
    uint32_t elapsed=now-started,left=std::min(elapsed,duration);int n=0;
    for(;n<path_count-1&&left>segments[n].ms;++n)left-=segments[n].ms;
    const auto &s=segments[n];double t=std::min(1.0,(double)left/s.ms),pair[2];
    if(!inverse(path_leg,{s.from.x+(s.to.x-s.from.x)*t,s.from.y+(s.to.y-s.from.y)*t},pair)){error=true;busy=false;path_active=false;return;}
    for(int j=0;j<2;++j){
      int i=path_leg*2+j;double physical=center[i]+(reversed[i]?-pair[j]:pair[j]);
      if(write&&!write(channel[i],physical)){error=true;ready=false;busy=false;path_active=false;return;}
      position[i]=pair[j];
    }
    if(elapsed>=duration){busy=false;path_active=false;}
  }

  void service(uint32_t now){
    if(!busy)return;
    if(path_active){path_service(now);return;}
    uint32_t elapsed=now-started;double t=std::min(1.0,(double)elapsed/duration);
    for(int i=0;i<8;++i)if(mask&(1U<<i)){
      double value=from[i]+(target[i]-from[i])*t;
      int physical=center[i]+(reversed[i]?-1:1)*(int)std::lround(value);
      if(write&&!write(channel[i],physical)){error=true;ready=false;busy=false;return;}
      position[i]=value;
    }
    if(elapsed>=duration)busy=false;
  }
  void halt(){busy=false;path_active=false;}
};
`;
