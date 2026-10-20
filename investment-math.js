/* Pure calculations. No account data, credentials, storage or network calls. */
(function(root) {
  'use strict';
  const number = v => typeof v === 'number' ? (Number.isFinite(v) ? v : NaN) :
    (String(v ?? '').trim() ? Number(String(v).replace(/,/g, '').trim()) : NaN);
  function date(raw) {
    let y,m,d;
    const s=String(raw ?? '').trim();
    let a=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if(a) [,y,m,d]=a.map(Number);
    else { a=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!a)return null; [,d,m,y]=a.map(Number); }
    if(y>2400)y-=543;
    const t=Date.UTC(y,m-1,d), dt=new Date(t);
    return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d ? dt.toISOString().slice(0,10) : null;
  }
  function prepare(headers, rows) {
    const map=new Map(); let invalidDates=0, duplicates=0;
    for(const row of rows || []) {
      const day=date(row[0]); if(!day){invalidDates++;continue;}
      if(map.has(day))duplicates++;
      map.set(day,{date:day,values:headers.map((_,i)=>i?number(row[i]):day)});
    }
    return {rows:[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)),invalidDates,duplicates};
  }
  function series(rows, columns) {
    if(!columns.length)return [];
    return rows.flatMap(r=>{
      let value=0;
      for(const c of columns){const nav=r.values[c.index];if(!(nav>0))return [];value+=nav*c.units;}
      return value>0?[{date:r.date,value}]:[];
    });
  }
  function metrics(points) {
    if(points.length<2)return null;
    let peak=points[0], maxPeak=peak, trough=peak, maxDD=0, lastPeak=peak, worst=Infinity,best=-Infinity;
    const returns=[], curve=[];
    points.forEach((p,i)=>{
      if(p.value>=peak.value){peak=p;lastPeak=p;}
      const dd=p.value/peak.value-1;
      if(dd<maxDD){maxDD=dd;maxPeak=peak;trough=p;}
      curve.push({date:p.date,dd,index:p.value/points[0].value*100});
      if(i){const r=p.value/points[i-1].value-1;returns.push(r);worst=Math.min(worst,r);best=Math.max(best,r);}
    });
    const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
    const vol=returns.length>=20?Math.sqrt(returns.reduce((a,r)=>a+(r-mean)**2,0)/(returns.length-1))*Math.sqrt(252):null;
    const last=points.at(-1), currentDD=last.value/peak.value-1;
    const recovery=maxDD<0?points.find(p=>p.date>trough.date && p.value>=maxPeak.value):null;
    const days=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
    return {total:last.value/points[0].value-1,currentDD,maxDD,vol,best,worst,
      positive:returns.filter(r=>r>0).length/returns.length,recoveryRequired:peak.value/last.value-1,
      underwaterDays:currentDD<0?days(lastPeak.date,last.date):0,
      peakDate:maxDD<0?maxPeak.date:null,troughDate:maxDD<0?trough.date:null,recoveryDate:recovery?.date||null,
      start:points[0].date,end:last.date,count:points.length,curve};
  }
  function monthly(points) {
    const groups=new Map();
    points.forEach(p=>groups.set(p.date.slice(0,7),p));
    let previous=points[0];
    return [...groups].map(([month,last],i)=>{const result={month,value:last.value/previous.value-1,partial:i===0||i===groups.size-1};previous=last;return result;});
  }
  const api={number,date,prepare,series,metrics,monthly};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.GpfMath=api;
})(typeof window!=='undefined'?window:globalThis);
