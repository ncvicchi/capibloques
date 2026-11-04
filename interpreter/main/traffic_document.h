#pragma once
#include "cJSON.h"
#include <cmath>
#include <cstring>
#include <cstdlib>
#include <string>
#include "traffic_canvas.h"
#include "traffic_world.h"

namespace capi_traffic {
inline cJSON *field(cJSON *v,const char *key){return cJSON_GetObjectItem(v,key);}
inline const char *str(cJSON *v){return cJSON_IsString(v)&&v->valuestring?v->valuestring:"";}
inline double at(cJSON *v,int index){cJSON *n=cJSON_GetArrayItem(v,index);return cJSON_IsNumber(n)?n->valuedouble:0;}
inline bool coordinate(cJSON *v){return cJSON_IsNumber(v)&&std::isfinite(v->valuedouble)&&std::abs(v->valuedouble)<=4096;}
inline bool color(cJSON *v){const char *s=str(v);if(strlen(s)!=7||*s!='#')return false;for(int i=1;i<7;++i)if(!strchr("0123456789abcdefABCDEF",s[i]))return false;return true;}
inline bool list_valid(cJSON *list,int limit=128){
  if(!cJSON_IsArray(list)||cJSON_GetArraySize(list)>limit)return false;
  cJSON *p;
  cJSON_ArrayForEach(p,list){
    if(!cJSON_IsArray(p))return false;
    const char *op=str(cJSON_GetArrayItem(p,0));int count=cJSON_GetArraySize(p);
    if(!strcmp(op,"p")){
      cJSON *points=cJSON_GetArrayItem(p,1),*n;
      int size=cJSON_GetArraySize(points);
      if(count!=3||!cJSON_IsArray(points)||size<6||size>32||size%2||!color(cJSON_GetArrayItem(p,2)))return false;
      cJSON_ArrayForEach(n,points)if(!coordinate(n))return false;
      continue;
    }
    if(!coordinate(cJSON_GetArrayItem(p,1))||!coordinate(cJSON_GetArrayItem(p,2)))return false;
    if(!strcmp(op,"r")){
      if(count!=6||!coordinate(cJSON_GetArrayItem(p,3))||!coordinate(cJSON_GetArrayItem(p,4))||at(p,3)<=0||at(p,4)<=0||!color(cJSON_GetArrayItem(p,5)))return false;
    }else if(!strcmp(op,"c")||!strcmp(op,"lamp")){
      if(!coordinate(cJSON_GetArrayItem(p,3))||at(p,3)<=0||at(p,3)>100||!color(cJSON_GetArrayItem(p,4)))return false;
      if(!strcmp(op,"c")){if(count!=5)return false;}
      else {const char *state=str(cJSON_GetArrayItem(p,6));if(count!=7||!color(cJSON_GetArrayItem(p,5))||(strcmp(state,"RED")&&strcmp(state,"YELLOW")&&strcmp(state,"GREEN")))return false;}
    }else if(!strcmp(op,"t")){
      if(count!=6||!cJSON_IsString(cJSON_GetArrayItem(p,3))||strlen(str(cJSON_GetArrayItem(p,3)))>64||!color(cJSON_GetArrayItem(p,4))||at(p,5)<1||at(p,5)>4||at(p,5)!=(int)at(p,5))return false;
    }else if(!strcmp(op,"matrix")){
      const char *property=str(cJSON_GetArrayItem(p,3));if(count!=4||(strcmp(property,"vehicleDisplay")&&strcmp(property,"pedestrianDisplay")))return false;
    }else return false;
  }
  return true;
}
inline bool document_valid(cJSON *p){
  if(!p)return true; // Legacy rules still render with their legacy layout.
  cJSON *width=field(p,"width"),*height=field(p,"height"),*version=field(p,"version");
  if(!cJSON_IsNumber(version)||version->valuedouble!=1||!coordinate(width)||!coordinate(height)||width->valueint<320||width->valueint>1920||height->valueint<180||height->valueint>1080||!list_valid(field(p,"background")))return false;
  cJSON *signals=field(p,"signals"),*labels=field(p,"labels"),*v;
  if(!cJSON_IsArray(signals)||cJSON_GetArraySize(signals)>4||!cJSON_IsArray(labels)||cJSON_GetArraySize(labels)>64)return false;
  cJSON_ArrayForEach(v,signals){
    if(!*str(field(v,"id"))||!coordinate(field(v,"x"))||!coordinate(field(v,"y"))||!list_valid(field(v,"primitives"),16))return false;
    for(const char *key:{"lane","crossing"}){cJSON *n=field(v,key);if(!cJSON_IsNumber(n)||n->valuedouble!=n->valueint||n->valueint<0||n->valueint>3)return false;}
  }
  cJSON_ArrayForEach(v,labels){
    for(const char *key:{"x","y","width","height"})if(!coordinate(field(v,key)))return false;
    cJSON *lines=field(v,"lines"),*line;
    if(!cJSON_IsArray(lines)||cJSON_GetArraySize(lines)>3)return false;
    cJSON_ArrayForEach(line,lines){if(!cJSON_IsString(line)||strlen(str(line))>72)return false;int count=0;for(const unsigned char *c=(const unsigned char*)str(line);*c;++c)if((*c&0xc0)!=0x80)++count;if(count>18)return false;}
    cJSON *scale=field(v,"fontScale"),*line_height=field(v,"lineHeight");
    if(!cJSON_IsNumber(scale)||scale->valuedouble!=scale->valueint||scale->valueint<1||scale->valueint>4||!cJSON_IsNumber(line_height)||line_height->valueint<scale->valueint*8||line_height->valueint>40)return false;
    double x=field(v,"x")->valuedouble,y=field(v,"y")->valuedouble,w=field(v,"width")->valuedouble,h=field(v,"height")->valuedouble;
    if(x<0||y<0||w<=0||h<=0||x+w>width->valuedouble||y+h>height->valuedouble)return false;
  }
  cJSON *boxes=field(p,"boxes");if(!cJSON_IsArray(boxes)||cJSON_GetArraySize(boxes)>64)return false;
  cJSON_ArrayForEach(v,boxes){for(const char *key:{"x","y","width","height"})if(!coordinate(field(v,key)))return false;}
  for(const char *key:{"cars","people"}){
    cJSON *shapes=field(p,key),*shape;if(!cJSON_IsArray(shapes)||cJSON_GetArraySize(shapes)!=(!strcmp(key,"cars")?4:2))return false;
    cJSON_ArrayForEach(shape,shapes)if(!list_valid(shape,16))return false;
  }
  return list_valid(field(p,"conflict"),4);
}
inline uint32_t rgb(cJSON *v){const char *s=str(v);return *s=='#'?(uint32_t)strtoul(s+1,nullptr,16):0;}
inline Point rotate(double x,double y,int quarter){if(quarter==1)return {-y,x};if(quarter==2)return {-x,-y};if(quarter==3)return {y,-x};return {x,y};}
template<class Painter,class Get,class Glyph> void draw(Canvas<Painter> &canvas,cJSON *list,double dx,double dy,int quarter,Get get,Glyph glyph){
  cJSON *p;
  cJSON_ArrayForEach(p,list){
    const char *op=str(cJSON_GetArrayItem(p,0));double x=at(p,1),y=at(p,2);Point origin=rotate(x,y,quarter);
    if(!strcmp(op,"r")){
      double w=at(p,3),h=at(p,4);Point opposite=rotate(x+w,y+h,quarter);
      canvas.rect(dx+std::min(origin.x,opposite.x),dy+std::min(origin.y,opposite.y),std::abs(opposite.x-origin.x),std::abs(opposite.y-origin.y),rgb(cJSON_GetArrayItem(p,5)));
    }else if(!strcmp(op,"c")||!strcmp(op,"lamp")){
      int index=!strcmp(op,"lamp")&&get("color")==str(cJSON_GetArrayItem(p,6))?5:4;
      canvas.circle(dx+origin.x,dy+origin.y,at(p,3),rgb(cJSON_GetArrayItem(p,index)));
    }else if(!strcmp(op,"p")){
      cJSON *values=cJSON_GetArrayItem(p,1);std::vector<double> points;
      for(int i=0;i<cJSON_GetArraySize(values);i+=2){Point point=rotate(at(values,i),at(values,i+1),quarter);points.push_back(dx+point.x);points.push_back(dy+point.y);}
      canvas.polygon(points,rgb(cJSON_GetArrayItem(p,2)));
    }else if(!strcmp(op,"t"))canvas.text(dx+x,dy+y,str(cJSON_GetArrayItem(p,3)),rgb(cJSON_GetArrayItem(p,4)),(int)at(p,5));
    else if(!strcmp(op,"matrix")){
      const char *property=str(cJSON_GetArrayItem(p,3));const uint8_t *rows=glyph(get(property).c_str());
      canvas.rect(dx+x-2,dy+y-2,28,28,0x181c26);
      for(int row=0;row<8;++row)for(int col=0;col<8;++col)if(rows[row]&(1<<(7-col)))canvas.rect(dx+x+col*3,dy+y+row*3,2,2,!strcmp(property,"vehicleDisplay")?0xffb21c:0xffffff);
    }
  }
}
}
