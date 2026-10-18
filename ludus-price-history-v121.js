/* Server prices only. The chart never fabricates earlier or future observations. */
var LudusPriceHistory=(()=>{
 'use strict';
 const number=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
 const clock=t=>new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'}).format(new Date(t));
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function create(g,now){
  const figure=el('figure','supply-price-chart'),header=el('figcaption'),name=el('strong','','Son 24 saat'),cadence=el('small','','15 dk / fiyat');header.append(name,cadence);figure.append(header);
  const raw=g?.history?.points,points=Array.isArray(raw)?raw.filter(p=>Number.isFinite(Date.parse(p.at))&&Number.isFinite(Number(p.price))&&Number(p.price)>0&&Date.parse(p.at)<=Date.parse(now)).map(p=>({at:Date.parse(p.at),price:Number(p.price)})).sort((a,b)=>a.at-b.at):[];
  if(!points.length){figure.append(el('p','supply-chart-empty','Fiyat geçmişi bu güncellemeden itibaren kaydedilir.'));return figure;}
  const end=Date.parse(g.history.day_end)||Date.parse(now),start=end-86400000,data=points.filter(p=>p.at>=start&&p.at<=end),values=data.map(p=>p.price);
  if(!data.length){figure.append(el('p','supply-chart-empty','Bu zaman aralığında fiyat kaydı yok.'));return figure;}
  const min=Math.min(...values),max=Math.max(...values),avg=values.reduce((a,b)=>a+b,0)/values.length,base=Number(g.base_price)||0,current=Number(g.unit_price),ratio=data.length>=4?current/avg:base?current/base:null,cheap=data.length>=4?.85:1.8,costly=data.length>=4?1.15:3.4;
  const badge=el('span','supply-price-level',ratio===null?'':ratio<=cheap?'Uygun':ratio<=costly?'Orta':'Pahalı');badge.dataset.level=ratio===null?'unknown':ratio<=cheap?'low':ratio<=costly?'mid':'high';badge.title=data.length>=4?'Kayıtlı fiyat ortalamasına göre '+(ratio>=1?'+':'')+number((ratio-1)*100)+'%':base?'Taban fiyat: '+number(base)+' d. · '+number(ratio)+' katı':'';header.append(badge);
  const width=480,height=80,left=38,right=12,top=6,bottom=20,low=Math.min(min,base||min)*.9,high=Math.max(max,current,base||max)*1.1,range=Math.max(.01,high-low),x=t=>left+(t-start)/86400000*(width-left-right),y=p=>height-bottom-(p-low)/range*(height-top-bottom);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('role','img');svg.setAttribute('aria-label',g.name+' son 24 saatlik fiyatı; fiyatlar 15 dakikada bir değişir.');svg.dataset.points=String(data.length);
  function shape(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;svg.append(n);return n;}
  for(let h=0;h<=24;h++){const at=start+h*3600000;shape('line',{x1:x(at),x2:x(at),y1:top,y2:height-bottom,class:'supply-chart-grid'});if(h%4===0)shape('text',{x:x(at),y:height-6,'text-anchor':h===0?'start':h===24?'end':'middle',class:'supply-chart-label'},clock(at));}
  for(const price of [low,(low+high)/2,high]){shape('line',{x1:left,x2:width-right,y1:y(price),y2:y(price),class:'supply-chart-grid'});shape('text',{x:left-5,y:y(price)+3,'text-anchor':'end',class:'supply-chart-label'},number(price));}
  if(base){shape('line',{x1:left,x2:width-right,y1:y(base),y2:y(base),class:'supply-chart-base'});}
  let path='M'+x(data[0].at)+','+y(data[0].price);for(let i=1;i<data.length;i++)path+='H'+x(data[i].at)+'V'+y(data[i].price);path+='H'+x(end);shape('path',{d:path,class:'supply-chart-line'});
  const cursor=shape('line',{x1:0,x2:0,y1:top,y2:height-bottom,class:'supply-chart-cursor'}),dot=shape('circle',{cx:0,cy:0,r:4,class:'supply-chart-dot'});
  const readout=el('output','supply-chart-readout'),slider=el('input','supply-chart-slider');slider.type='range';slider.min='0';slider.max=String(data.length-1);slider.step='1';slider.value=slider.max;slider.setAttribute('aria-label','Fiyatın saatini seç');
  function select(index){const i=Math.max(0,Math.min(data.length-1,index)),p=data[i];slider.value=String(i);cursor.setAttribute('x1',x(p.at));cursor.setAttribute('x2',x(p.at));dot.setAttribute('cx',x(p.at));dot.setAttribute('cy',y(p.price));readout.value=clock(p.at)+' · '+number(p.price)+' d. / birim';slider.setAttribute('aria-valuetext',readout.value);}
  slider.oninput=()=>select(Number(slider.value));svg.addEventListener('pointerdown',e=>{const matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const at=start+Math.max(0,Math.min(1,(point.matrixTransform(matrix.inverse()).x-left)/(width-left-right)))*86400000;let i=0;for(let j=1;j<data.length;j++)if(Math.abs(data[j].at-at)<Math.abs(data[i].at-at))i=j;select(i);});select(data.length-1);
  const stats=el('div','supply-chart-stats');stats.append(el('span','','Düşük '+number(min)),el('span','','Ort. '+number(avg)),el('span','','Yüksek '+number(max)));const note=el('small','supply-chart-note',data.length<96?'Geçmiş oluşuyor · Taban '+number(base)+' d.':'Ortalamaya göre '+(ratio>=1?'+':'')+number((ratio-1)*100)+'% · Taban '+number(base)+' d.');
  figure.append(svg,readout,slider,stats,note);return figure;
 }
 return {create};
})();
