import { useMemo } from 'react';
import { IDF_FONT } from '@/lib/idf-font';
import { trafficDisplayRows, type VehicleDisplayValue, type PedestrianDisplayValue } from '@/lib/traffic-displays';
import { trafficAscii, type TrafficPrimitive, type TrafficLabel } from '@/lib/traffic-presentation';

export function TrafficPixelText({x,y,text,color='#31395e',scale=2}:{x:number;y:number;text:string;color?:string;scale?:number}) {
  const path=useMemo(()=>{
    const cells:string[]=[];
    const dot=(index:number,column:number,row:number)=>cells.push(`M${x+(index*6+column)*scale},${y+row*scale}h${scale}v${scale}h${-scale}z`);
    Array.from(trafficAscii(text)).forEach((char,index)=>{
      const parts=char.normalize('NFD'),glyph=(parts.charCodeAt(0)-32)*5;
      const accents=parts[1]==='\u0301'?[[2,-1],[3,-2]]:parts[1]==='\u0303'?[[1,-2],[2,-2],[3,-1]]:parts[1]==='\u0308'?[[1,-2],[3,-2]]:[];
      accents.forEach(([column,row])=>dot(index,column,row));
      for(let column=0;column<5;column++)for(let row=0;row<7;row++)if(IDF_FONT[glyph+column]&(1<<row))dot(index,column,row);
    });return cells.join('');
  },[x,y,text,scale]);
  return <path fill={color} d={path} aria-hidden="true"/>;
}

export function TrafficPrimitives({primitives,state={}}:{primitives:readonly TrafficPrimitive[];state?:{color?:string;vehicleDisplay?:VehicleDisplayValue;pedestrianDisplay?:PedestrianDisplayValue}}) {
  return <>{primitives.map((p,index)=>{
    if(p[0]==='r')return <rect key={index} x={p[1]} y={p[2]} width={p[3]} height={p[4]} fill={p[5]}/>;
    if(p[0]==='c'||p[0]==='lamp')return <circle key={index} cx={p[1]} cy={p[2]} r={p[3]} fill={p[0]==='lamp'&&state.color===p[6]?p[5]:p[4]}/>;
    if(p[0]==='p')return <polygon key={index} points={p[1].reduce((out,v,i)=>out+(i%2?',':' ')+v,'').trim()} fill={p[2]}/>;
    if(p[0]==='t')return <TrafficPixelText key={index} x={p[1]} y={p[2]} text={p[3]} color={p[4]} scale={p[5]}/>;
    const value=state[p[3]]??'OFF'; const rows=trafficDisplayRows(value);
    return <g key={index}><rect x={p[1]-2} y={p[2]-2} width="28" height="28" fill="#181c26"/>{rows.flatMap((row,y)=>Array.from({length:8},(_,x)=> (row&(1<<(7-x))) ? <rect key={`${x}-${y}`} x={p[1]+x*3} y={p[2]+y*3} width="2" height="2" fill={p[3]==='vehicleDisplay'?'#ffb21c':'#ffffff'}/> : null))}</g>;
  })}</>;
}

export function TrafficLabels({labels,names}:{labels:TrafficLabel[];names:Map<string,string>}) {
  return <g className="traffic-captions">{labels.map(label=><g key={label.id} data-traffic-label={label.id} aria-label={names.get(label.id)}>
    <title>{names.get(label.id)}</title><rect x={label.x} y={label.y} width={label.width} height={label.height} fill="#ffffff" stroke="#b4bdc9" strokeWidth="1"/>
    {label.lines.map((line,index)=><TrafficPixelText key={index} x={label.x+6} y={label.y+6+index*label.lineHeight} scale={label.fontScale} text={line}/>)}
  </g>)}</g>;
}
