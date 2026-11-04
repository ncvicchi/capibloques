#pragma once
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

// Companion of lib/traffic-world.ts / pedestrian-world.ts. Differential tests
// compare complete populations and positions; no traffic decisions are invented.
namespace capi_traffic {
struct Point { double x,y; };
struct Car { uint32_t id; int lane; double progress=0; bool crashed=false,waiting=false,clearing=false; };
struct Person { uint32_t id; int crossing,direction; double progress=0; bool started=false; };
inline Point car_position(const Car &car){
  if(car.lane==0)return {-45+car.progress*1050,315};
  if(car.lane==1)return {1005-car.progress*1050,225};
  if(car.lane==2)return {435,-40+car.progress*620};
  return {525,580-car.progress*620};
}
inline Point person_position(const Person &person,int queue=0){
  const Point from[]={{380,165},{585,170},{380,375},{375,170}};
  const Point to[]={{580,165},{585,370},{580,375},{375,370}};
  Point a=person.direction==1?from[person.crossing]:to[person.crossing];
  Point b=person.direction==1?to[person.crossing]:from[person.crossing];
  double progress=person.started?person.progress:-0.045-queue*0.065;
  return {a.x+(b.x-a.x)*progress,a.y+(b.y-a.y)*progress};
}
struct World {
  std::vector<Car> cars; std::vector<Person> people;
  std::array<double,4> spawn{{0,1100,650,1700}},ped_spawn{{300,700,1100,1500}};
  std::array<int,4> direction{{1,1,1,1}};
  uint32_t next_car=1,next_person=1,random=0xc4a1b10c,ped_random=0x70656174;
  bool collision=false,ped_collision=false;
  uint32_t hit_car=0,hit_person=0;
  void tick(double elapsed,const std::array<bool,4> &green,const std::array<bool,4> &enabled,const std::array<int,4> &walk){
    if(collision||ped_collision)return;
    const double ms=std::clamp(elapsed,0.0,100.0);
    const double stops[]={.37,.37,.3,.3},gaps[]={.055,.055,.088,.088},entry[]={.07,.07,.11,.11},duration[]={12000,12000,10500,10500};
    cars.erase(std::remove_if(cars.begin(),cars.end(),[&](const Car &c){return !enabled[c.lane];}),cars.end());
    for(int lane=0;lane<4;++lane){
      if(!enabled[lane])continue;
      std::vector<Car*> approaching;
      for(auto &car:cars)if(car.lane==lane&&!car.crashed&&car.progress<=stops[lane])approaching.push_back(&car);
      std::stable_sort(approaching.begin(),approaching.end(),[](const Car *a,const Car *b){return a->progress>b->progress;});
      for(auto &car:cars){
        if(car.lane!=lane||car.crashed)continue;
        if(green[lane]){car.progress+=ms/duration[lane];car.waiting=false;car.clearing=false;}
        else if(car.clearing||car.progress>stops[lane]){car.progress+=ms/duration[lane];car.waiting=false;car.clearing=true;}
        else {
          const auto found=std::find(approaching.begin(),approaching.end(),&car);
          const double target=stops[lane]-(found-approaching.begin())*gaps[lane];
          if(car.progress<target)car.progress=std::min(target,car.progress+ms/duration[lane]);
          car.waiting=car.progress>=target;car.clearing=false;
        }
      }
    }
    cars.erase(std::remove_if(cars.begin(),cars.end(),[](const Car &c){return c.progress>=1;}),cars.end());
    for(int lane=0;lane<4;++lane){
      if(!enabled[lane])continue;
      spawn[lane]=std::max(0.0,spawn[lane]-ms);
      bool busy=std::any_of(cars.begin(),cars.end(),[&](const Car &c){return c.lane==lane&&c.progress<entry[lane];});
      if(spawn[lane]>0||cars.size()>=12||busy)continue;
      cars.push_back({next_car++,lane});random=random*1664525U+1013904223U;
      double value=random/4294967296.0;spawn[lane]=450+std::floor(value*value*5550+.5);
    }
    for(auto &horizontal:cars){
      if(horizontal.lane>1||horizontal.crashed)continue;
      Point a=car_position(horizontal);
      if(a.x<430||a.x>535||a.y<220||a.y>325)continue;
      for(auto &vertical:cars){
        if(vertical.lane<2||vertical.crashed)continue;
        Point b=car_position(vertical);
        if(b.x<430||b.x>535||b.y<220||b.y>325)continue;
        if(std::abs(a.x-b.x)<34&&std::abs(a.y-b.y)<34){horizontal.crashed=true;vertical.crashed=true;collision=true;return;}
      }
    }
    if(ms<=0)return;
    people.erase(std::remove_if(people.begin(),people.end(),[&](const Person &p){return walk[p.crossing]<0&&!p.started;}),people.end());
    for(auto &person:people)if(person.started||walk[person.crossing]==1){person.started=true;person.progress+=ms/5500;}
    people.erase(std::remove_if(people.begin(),people.end(),[](const Person &p){return p.progress>=1;}),people.end());
    for(int crossing=0;crossing<4;++crossing){
      if(walk[crossing]<0)continue;
      ped_spawn[crossing]=std::max(0.0,ped_spawn[crossing]-ms);
      const int count=(int)std::count_if(people.begin(),people.end(),[&](const Person &p){return p.crossing==crossing;});
      if(ped_spawn[crossing]>0||people.size()>=16||count>=4)continue;
      people.push_back({next_person++,crossing,direction[crossing]});direction[crossing]*=-1;
      ped_random=ped_random*1664525U+1013904223U;ped_spawn[crossing]=1800+std::floor(ped_random/4294967296.0*5000+.5);
    }
    for(const auto &person:people){
      if(!person.started)continue;
      Point a=person_position(person);
      for(auto &car:cars){Point b=car_position(car);bool horizontal=car.lane<2;
        if(std::abs(a.x-b.x)<(horizontal?22:14)&&std::abs(a.y-b.y)<(horizontal?14:18)){
          car.crashed=true;ped_collision=true;hit_car=car.id;hit_person=person.id;return;
        }
      }
    }
  }
};
}
