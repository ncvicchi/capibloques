"""Read-only STL pivot measurement. Usage: python scripts/measure-gorilla-v3.py PATH_TO_FILES.

Uses circular surface vertices, NOT outside bounding-box lengths. The supplied
assembly viewer has approximate positions; it is deliberately not the authority.
No third-party modules, file writes, execution of supplied scripts or CAD edits.
"""
import collections
import hashlib
import itertools
import json
import math
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET
import zipfile

def vertices(path):
    data=path.read_bytes()
    count=struct.unpack_from('<I',data,80)[0]
    if len(data)!=84+50*count:
        raise ValueError('Expected binary STL')
    points={tuple(struct.unpack_from('<12fH',data,84+50*i)[j:j+3]) for i in range(count) for j in (3,6,9)}
    bounds=[(min(p[k] for p in points),max(p[k] for p in points)) for k in range(3)]
    mid=[sum(b)/2 for b in bounds]
    return {(round(x-mid[0],5),round(y-mid[1],5),round(z-bounds[2][0],5)) for x,y,z in points}

def circle(points):
    votes=collections.Counter()
    for a,b,c in itertools.combinations(sorted(set(points)),3):
        det=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]))
        if abs(det)<.01:continue
        aa,bb,cc=[sum(v*v for v in p) for p in (a,b,c)]
        x=(aa*(b[1]-c[1])+bb*(c[1]-a[1])+cc*(a[1]-b[1]))/det
        y=(aa*(c[0]-b[0])+bb*(a[0]-c[0])+cc*(b[0]-a[0]))/det
        r=math.hypot(x-a[0],y-a[1])
        if 3.5<r<4.6:votes[(round(x,2),round(y,2),round(r,2))]+=1
    if not votes:raise ValueError('No pivot circle detected')
    value,count=votes.most_common(1)[0]
    if count<100:raise ValueError('Insufficient circular evidence')
    return dict(center=value[:2],radius=value[2],votes=count)

def main():
    root=Path(sys.argv[1])
    result={'method':'circular vertex consensus; nominal dimensions within 0.1mm','parts':{}}
    for name in ('THIGH_SERVO_MG90S_v3','THIGH','CALF_EXT','CALF_INT'):
        path=root/('INDIVIDUAL_'+name+'.stl');v=vertices(path)
        pivot=25 if name.startswith('THIGH') else 50
        rings=[circle({(x,y) for x,y,z in v if abs(x)<4.5 and abs(y-side*pivot)<6}) for side in (-1,1)]
        length=math.dist(rings[0]['center'],rings[1]['center'])
        expected=50 if pivot==25 else 100
        if abs(length-expected)>.1:raise ValueError('Unexpected geometry '+name)
        result['parts'][name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pivots':rings,'distance':round(length,4),'nominal':expected}
    path=root/'INDIVIDUAL_BASE_FRONT.stl';v=vertices(path)
    rings=[circle({(y,z) for x,y,z in v if abs(x+50.125)<.01 and abs(y-c)<5 and abs(z-6)<5}) for c in (-36.35,9.65)]
    length=math.dist(rings[0]['center'],rings[1]['center'])
    if abs(length-46)>.1:raise ValueError('Unexpected base spacing')
    result['parts']['BASE_FRONT']={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pivots_yz':rings,'distance':length,'nominal':46}
    path=root/'INDIVIDUAL_BASE_BACK.stl';v=vertices(path)
    rings=[circle({(y,z) for x,y,z in v if abs(x+50.125)<.01 and abs(z-6)<5 and y*side>0}) for side in (-1,1)]
    length=math.dist(rings[0]['center'],rings[1]['center'])
    if abs(length-46)>.1:raise ValueError('Unexpected rear base spacing')
    result['parts']['BASE_BACK']={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pivots_yz':rings,'distance':length,'nominal':46}
    path=root/'THIGH_SERVO_MG90S_v3_x8.3mf'
    with zipfile.ZipFile(path) as z:
        items=0
        for name in z.namelist():
            if not name.endswith('.model'):continue
            doc=ET.fromstring(z.read(name))
            if doc.attrib.get('unit','millimeter')!='millimeter':raise ValueError('Unexpected 3MF units')
            for e in doc.iter():
                if e.tag.endswith('build'):items+=len(e)
                transform=e.attrib.get('transform')
                if not transform:continue
                t=list(map(float,transform.split()))
                if len(t)!=12 or any(abs(sum(t[i]*t[i] for i in range(j*3,j*3+3))-1)>.0001 for j in range(3)) or any(abs(sum(t[i+a*3]*t[i+b*3] for i in range(3)))>.0001 for a,b in ((0,1),(0,2),(1,2))):
                    raise ValueError('3MF contains scaling/shear')
        if items!=8:raise ValueError('Expected eight build items')
    result['3mf']={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'items':items,'unit':'millimeter','transforms':'rigid, no scaling'}
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
