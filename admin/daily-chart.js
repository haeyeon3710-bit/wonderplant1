(()=>{
 const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';let snapshot;
 const number=value=>Number(value||0).toLocaleString('ko-KR');
 const svgNode=(tag,attributes={},text)=>{const el=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attributes))el.setAttribute(name,String(value));if(text!==undefined)el.textContent=text;return el;};
 function render(data,today){
  snapshot={data,today};const days=data.days.filter(day=>day.day<=today),host=$('daily-chart');host.replaceChildren();
  if(!days.length){$('daily-selected').textContent='표시할 날짜가 없습니다.';return;}
  const minimumWidth=Math.max(360,days.length*25+66),width=Math.max(minimumWidth,host.clientWidth||560),height=300,left=42,right=18,top=18,bottom=58,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const views=days.map(day=>Math.max(0,Number(day.views)||0)),maximum=Math.max(2,Math.ceil(Math.max(...views)/2)*2),svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':$('daily-caption').textContent});
  svg.style.minWidth=minimumWidth+'px';
  svg.append(svgNode('title',{},$('daily-caption').textContent),svgNode('desc',{},'가로축은 날짜, 세로축은 조회수입니다. 각 날짜를 선택하면 조회수를 확인할 수 있습니다.'));
  svg.append(svgNode('rect',{x:left,y:top,width:plotWidth,height:plotHeight,fill:'#f5fbfe'}));
  for(const value of [0,maximum/2,maximum]){
   const y=top+plotHeight*(1-value/maximum);svg.append(svgNode('line',{x1:left,x2:width-right,y1:y,y2:y,class:value===0?'daily-baseline':'daily-grid'}),svgNode('text',{x:left-10,y:y+4,'text-anchor':'end',class:'daily-axis'},number(value)));
  }
  const points=days.map((day,index)=>({day,views:views[index],x:left+(days.length===1?plotWidth/2:index*plotWidth/(days.length-1)),y:top+plotHeight*(1-views[index]/maximum)}));
  for(const point of points){
   svg.append(svgNode('line',{x1:point.x,x2:point.x,y1:top,y2:top+plotHeight,class:'daily-day-grid'}),svgNode('text',{x:point.x,y:height-33,'text-anchor':'middle',class:'daily-axis'},Number(point.day.day.slice(8))+'일'));
  }
  svg.append(svgNode('text',{x:points[0].x,y:height-12,'text-anchor':'middle',class:'daily-month-axis'},Number(data.month.slice(5))+'월'));
  svg.append(svgNode('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#00cc39','stroke-width':1.8,'stroke-linejoin':'round','stroke-linecap':'round','vector-effect':'non-scaling-stroke',class:'daily-trend'}));
  let selected;
  const show=point=>{selected?.classList.remove('is-selected');selected=point.element;selected.classList.add('is-selected');$('daily-selected').textContent=point.label;};
  for(const point of points){
   point.label=Number(point.day.day.slice(5,7))+'월 '+Number(point.day.day.slice(8))+'일 · 조회수 '+number(point.views)+'회';
   const group=svgNode('g',{class:'daily-point',tabindex:0,role:'button','aria-label':point.label,'data-day':point.day.day});point.element=group;
   group.append(svgNode('title',{},point.label),svgNode('circle',{cx:point.x,cy:point.y,r:12,fill:'transparent'}),svgNode('circle',{cx:point.x,cy:point.y,r:4,fill:'#00cc39',stroke:'#fff','stroke-width':2,class:'daily-marker'}));
   for(const event of ['mouseenter','focus','click'])group.addEventListener(event,()=>show(point));
   group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();show(point);}});svg.append(group);
  }
  host.append(svg);show(points.at(-1));
 }
 if(typeof ResizeObserver==='function')new ResizeObserver(()=>{if(snapshot&&$('daily-chart').clientWidth>0)render(snapshot.data,snapshot.today);}).observe($('daily-chart'));
 window.WonderfulDailyChart={render};
})();
