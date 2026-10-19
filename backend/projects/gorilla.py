"""Storage validation for the measured v3 five-bar profile; no external packages."""
import math
import re

def geometry_valid(config, settings):
    k=config.get('kinematics')
    if k is None:
        return 'kinematics' not in config and 'trajectories' not in config
    if not isinstance(k,dict) or set(k)!=set(('profile','zeroAngles','verified','pulseMinUs','pulseMaxUs')):
        return False
    zeros=k['zeroAngles']
    if k['profile']!='gorilla-v3-50-100-46' or type(k['verified']) is not bool or not isinstance(zeros,list) or len(zeros)!=8 or not all(type(a) is int and 45<=a<=135 for a in zeros):
        return False
    if not (type(k['pulseMinUs']) is int and 500<=k['pulseMinUs']<=1200 and type(k['pulseMaxUs']) is int and 1800<=k['pulseMaxUs']<=2500):
        return False
    paths=config.get('trajectories',[])
    if not isinstance(paths,list) or len(paths)>8:
        return False
    def forward(leg,a,b):
        qa,qb=[math.radians(zeros[2*leg+j]+v) for j,v in enumerate((a,b))]
        ex,ey=23+50*math.cos(qa),50*math.sin(qa)
        fx,fy=-23+50*math.cos(qb),50*math.sin(qb)
        d=math.hypot(fx-ex,fy-ey)
        if ex-fx<4 or min(ey,fy)<5 or not 4<=d<198:
            return None
        h=math.sqrt(10000-d*d/4)
        x,y=(ex+fx)/2+(fy-ey)*h/d,(ey+fy)/2-(fx-ex)*h/d
        if y<=max(ey,fy) or abs((ex-23)*(y-ey)-ey*(x-ex))/5000<.12 or abs((fx+23)*(y-fy)-fy*(x-fx))/5000<.12:
            return None
        return x,y
    def inverse(leg,x,y):
        out=[]
        for j,base in enumerate((23,-23)):
            r=math.hypot(x-base,y)
            if not r: return None
            c=(r*r+2500-10000)/(100*r)
            if abs(c)>=.995:return None
            q=math.degrees(math.atan2(y,x-base)+(1 if j else -1)*math.acos(c))
            angle=q-zeros[2*leg+j];i=2*leg+j
            physical=settings[f'center{i}']+(-angle if settings[f'reversed{i}'] else angle)
            if not -20<=angle<=20 or not settings[f'min{i}']<=physical<=settings[f'max{i}']:return None
            out.append(angle)
        p=forward(leg,*out)
        return out if p and math.hypot(p[0]-x,p[1]-y)<.001 else None
    ids=set();names=set()
    for p in paths:
        if not isinstance(p,dict) or set(p)!=set(('id','name','leg','points')):return False
        if not isinstance(p['id'],str) or not re.fullmatch('[a-zA-Z0-9_-]{1,48}',p['id']) or p['id'] in ids:return False
        name=p['name'];leg=p['leg'];points=p['points']
        if not isinstance(name,str) or name!=name.strip() or not 1<=len(name)<=40 or name.lower() in names or type(leg) is not int or not 0<=leg<=3 or not isinstance(points,list) or not 1<=len(points)<=16:return False
        home=forward(leg,0,0)
        if not home:return False
        x,y=home;first=inverse(leg,x,y)
        if not first or any(abs(a)>.001 for a in first):return False
        total=effective_total=0
        for point in points:
            if not isinstance(point,dict) or set(point)!=set(('forward','up','ms')):return False
            if any(type(point[key]) not in (int,float) or not math.isfinite(point[key]) or abs(point[key])>limit for key,limit in (('forward',50),('up',30))) or type(point['ms']) is not int or not 200<=point['ms']<=10000:return False
            tx,ty=home[0]+point['forward'],home[1]-point['up']
            steps=max(16,math.ceil(math.hypot(tx-x,ty-y)/.25))
            if steps>256:return False
            previous=inverse(leg,x,y);rate=0
            if not previous:return False
            for n in range(1,steps+1):
                q=inverse(leg,x+(tx-x)*n/steps,y+(ty-y)*n/steps)
                if not q:return False
                rate=max(rate,*(abs(q[j]-previous[j])*steps*1000/30 for j in (0,1)));previous=q
            effective=max(point['ms'],math.ceil(rate*1.05))
            if effective>30000:return False
            total+=point['ms'];effective_total+=effective;x,y=tx,ty
        if total>120000 or effective_total>180000:return False
        ids.add(p['id']);names.add(name.lower())
    return True
