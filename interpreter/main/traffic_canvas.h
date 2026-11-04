#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

// Same letterbox transform as fitTrafficScene(). Painter owns the framebuffer.
namespace capi_traffic {
struct View {
  double scale, x, y;
  static View fit(int width,int height) {
    const double s=std::min(776.0/std::max(1,width),354.0/std::max(1,height));
    return {s,12+(776-width*s)/2,62+(354-height*s)/2};
  }
};
template<class Painter> class Canvas {
  Painter &paint; const uint8_t *font;
public:
  View view; int width,height;
  Canvas(Painter &p,const uint8_t *glyphs,int w,int h):paint(p),font(glyphs),view(View::fit(w,h)),width(w),height(h){}
  void rect(double x,double y,double w,double h,uint32_t color) {
    int left=(int)std::round(view.x+std::max(0.0,x)*view.scale);
    int top=(int)std::round(view.y+std::max(0.0,y)*view.scale);
    int right=(int)std::round(view.x+std::min<double>(width,x+w)*view.scale);
    int bottom=(int)std::round(view.y+std::min<double>(height,y+h)*view.scale);
    if(right>left&&bottom>top)paint.rect(left,top,right-left,bottom-top,color);
  }
  void circle(double x,double y,double radius,uint32_t color) {
    const int top=(int)std::floor(y-radius),bottom=(int)std::ceil(y+radius);
    for(int row=top;row<=bottom;++row){
      double d=row-y;if(std::abs(d)>radius)continue;
      double span=std::sqrt(std::max(0.0,radius*radius-d*d));rect(x-span,row,span*2+1,1,color);
    }
  }
  void polygon(const std::vector<double> &points,uint32_t color) {
    if(points.size()<6||points.size()>32||points.size()%2)return;
    double low=points[1],high=points[1];
    for(size_t i=1;i<points.size();i+=2){low=std::min(low,points[i]);high=std::max(high,points[i]);}
    for(int y=std::max(0,(int)std::floor(low));y<=std::min(height,(int)std::ceil(high));++y){
      std::vector<double> spans;
      for(size_t a=0,b=points.size()-2;a<points.size();b=a,a+=2){
        double ya=points[a+1],yb=points[b+1];
        if((ya<=y&&yb>y)||(yb<=y&&ya>y))spans.push_back(points[a]+(y-ya)*(points[b]-points[a])/(yb-ya));
      }
      std::sort(spans.begin(),spans.end());
      for(size_t i=0;i+1<spans.size();i+=2)rect(spans[i],y,spans[i+1]-spans[i]+1,1,color);
    }
  }
  void text(double x,double y,const char *value,uint32_t color,int scale=2) {
    if(!value||scale<1||scale>4)return;
    const unsigned char *cursor=(const unsigned char*)value;
    for(int index=0;*cursor&&index<64;++index){
      unsigned cp=*cursor++,c=cp;int mark=0;
      if(cp==0xc3&&(*cursor&0xc0)==0x80){cp=((cp&31)<<6)|(*cursor++&63);}
      else if(cp>=128){while((*cursor&0xc0)==0x80)++cursor;cp='?';}
      switch(cp){
        case 0xc1:c='A';mark=1;break;case 0xc9:c='E';mark=1;break;case 0xcd:c='I';mark=1;break;case 0xd3:c='O';mark=1;break;case 0xda:c='U';mark=1;break;
        case 0xe1:c='a';mark=1;break;case 0xe9:c='e';mark=1;break;case 0xed:c='i';mark=1;break;case 0xf3:c='o';mark=1;break;case 0xfa:c='u';mark=1;break;
        case 0xd1:c='N';mark=2;break;case 0xf1:c='n';mark=2;break;case 0xdc:c='U';mark=3;break;case 0xfc:c='u';mark=3;break;
        default:c=cp;break;
      }
      if(c<32||c>126)c='?';
      auto dot=[&](int column,int row){rect(x+(index*6+column)*scale,y+row*scale,scale,scale,color);};
      if(mark==1){dot(2,-1);dot(3,-2);}else if(mark==2){dot(1,-2);dot(2,-2);dot(3,-1);}else if(mark==3){dot(1,-2);dot(3,-2);}
      for(int column=0;column<5;++column)for(int row=0;row<7;++row)
        if(font[(c-32)*5+column]&(1<<row))dot(column,row);
    }
  }
};
}
