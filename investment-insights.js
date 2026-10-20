(function(){
  'use strict';
  const M=window.GpfMath;
  let source=null, chart=null, period='all';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=n=>Number.isFinite(n)?(n>0?'+':'')+(n*100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+'%':'—';
  const originalProcess=window.processData;
  window.processData=function(response){
    // Snapshot before the legacy renderer appends its custom portfolio column.
    source=response?.data&&response?.headers?{
      headers:response.headers.map(String),data:response.data.map(r=>r.slice()),units:{...(response.myUnits||{})}
    }:null;
    if(!source){const old=document.getElementById('investment-insights');if(old)old.remove();if(chart){chart.destroy();chart=null;}}
    try{return originalProcess.apply(this,arguments);}finally{render();}
  };
  const originalPrivacy=window.togglePrivacy;
  window.togglePrivacy=function(){originalPrivacy.apply(this,arguments);render();};
  const originalLogout=window.logout;
  window.logout=function(){source=null;if(chart){chart.destroy();chart=null;}const box=document.getElementById('investment-insights');if(box)box.remove();originalLogout.apply(this,arguments);};
  function mount(){
    let box=document.getElementById('investment-insights');
    if(box)return box;
    box=document.createElement('section');box.id='investment-insights';box.className='pastel-card investment-insights';
    const page=document.getElementById('page-portfolio');
    page.insertBefore(box,page.children[2]||null);
    box.addEventListener('change',e=>{if(e.target.id==='insight-period'){period=e.target.value;render();}});
    return box;
  }
  function render(){
    if(!source)return;
    const box=mount();
    if(chart){chart.destroy();chart=null;}
    const prepared=M.prepare(source.headers,source.data), all=prepared.rows;
    if(!all.length){box.textContent='ยังไม่มี NAV ที่มีวันที่ถูกต้องสำหรับวิเคราะห์';return;}
    const latest=all.at(-1).date;
    let start=all[0].date;
    if(period==='ytd')start=latest.slice(0,4)+'-01-01';
    else if(period!=='all'){const d=new Date(latest+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-Number(period));start=d.toISOString().slice(0,10);}
    const rows=all.filter(r=>r.date>=start);
    const columns=[], missing=[];
    Object.entries(source.units).forEach(([name,raw])=>{
      const units=M.number(raw),index=source.headers.indexOf(name);
      if(units>0){if(index>0)columns.push({name,index,units});else missing.push(name);}
    });
    const points=missing.length?[]:M.series(rows,columns), result=M.metrics(points);
    const hidden=typeof isMasked!=='undefined'&&isMasked;
    const v=n=>hidden?'••••':pct(n);
    const modes=[['all','ทั้งหมด'],['ytd','ปีล่าสุดในฐาน'],['90','90 วัน'],['30','30 วัน']];
    const head=`<div class="insight-heading"><div><p class="insight-eyebrow">RISK & PERFORMANCE</p><h2>ผลตอบแทนและความเสี่ยง</h2></div><label>ช่วงวิเคราะห์ <select id="insight-period">${modes.map(([id,label])=>`<option value="${id}" ${id===period?'selected':''}>${label}</option>`).join('')}</select></label></div>`;
    const method=`<p class="insight-method">พอร์ตจำลองด้วยหน่วยลงทุนปัจจุบันคงที่ × NAV ย้อนหลัง ไม่รวมเงินนำส่งและการเปลี่ยนแผนในอดีต จึงไม่ใช่ TWR / XIRR ของบัญชีจริง · จุดสูงสุดนับภายในช่วงที่เลือก</p>`;
    const stale=Math.floor((Date.now()-Date.parse(latest+'T00:00:00+07:00'))/86400000);
    const quality=`<div class="insight-quality">NAV ล่าสุด ${esc(latest)} · ข้อมูล ${rows.length} วัน${stale>4?` · ข้อมูลห่างจากวันนี้ ${stale} วัน`:''}${prepared.invalidDates?` · วันที่ไม่ถูกต้อง ${prepared.invalidDates} แถว`:''}${prepared.duplicates?` · วันที่ซ้ำ ${prepared.duplicates} แถว (ใช้แถวท้าย)`:''}${rows.length-points.length&&columns.length?` · พอร์ตใช้ได้ ${points.length}/${rows.length} วัน`:''}</div>`;
    if(!result){box.innerHTML=head+method+quality+`<p class="insight-empty">${missing.length?'ไม่พบ NAV ของแผนที่ถือ: '+esc(missing.join(', ')):columns.length?'ต้องมีข้อมูลครบทุกแผนอย่างน้อย 2 วันในช่วงที่เลือก':'ยังไม่มีหน่วยลงทุนสำหรับคำนวณพอร์ต'}</p>`;return;}
    const cards=[['Current Drawdown',v(result.currentDD),'ลดลงจากจุดสูงสุดในช่วง'],['Max Drawdown',v(result.maxDD),'การลดลงสูงสุดจากยอดถึงจุดต่ำ'],['ผลตอบแทนช่วงที่เลือก',v(result.total),'จำลองถือหน่วยเดิมตลอดช่วง'],['ความผันผวนต่อปี',v(result.vol),result.vol===null?'ต้องมีผลตอบแทนอย่างน้อย 20 ช่วง':'SD ผลตอบแทนแต่ละช่วง × √252'],['ผลตอบแทนเพื่อคืนยอด',v(result.recoveryRequired),'ต้องเติบโตเท่าไรเพื่อกลับยอดเดิม'],['ระยะต่ำกว่าจุดสูงสุด',hidden?'••••':result.underwaterDays+' วัน','วันปฏิทินถึง NAV ล่าสุด'],['ช่วงที่ดีที่สุด / แย่ที่สุด',v(result.best)+' / '+v(result.worst),'ระหว่าง NAV สองจุดติดกัน'],['สัดส่วนช่วงที่เป็นบวก',v(result.positive),'จำนวนช่วงบวก ÷ ทุกช่วง']];
    const cardsHtml=`<div class="insight-grid">${cards.map(([label,value,detail])=>`<article><h3>${label}</h3><strong>${value}</strong><p>${detail}</p></article>`).join('')}</div>`;
    let comparison='';
    if(!hidden){
      comparison=source.headers.slice(1).map((name,k)=>{
        const col=k+1,common=points.filter(p=>{const row=rows.find(r=>r.date===p.date);return row?.values[col]>0;});
        const bm=M.metrics(common.map(p=>({date:p.date,value:rows.find(r=>r.date===p.date).values[col]})));
        const pm=M.metrics(common);
        return `<tr><td>${esc(name)}</td><td>${pct(bm?.total)}</td><td>${pct(bm?.maxDD)}</td><td>${pct(bm?.vol)}</td><td>${bm&&pm?pct(pm.total-bm.total):'—'}</td><td>${bm?esc(bm.start+' → '+bm.end):'ข้อมูลไม่พอ'}</td></tr>`;
      }).join('');
    }
    const latestRow=all.at(-1);let total=0;
    const holdings=columns.map(c=>{const value=latestRow.values[c.index]*c.units;total+=Number.isFinite(value)?value:0;return {...c,value};});
    const allocationValid=!missing.length&&holdings.length&&holdings.every(c=>c.value>0);
    const largest=allocationValid?holdings.slice().sort((a,b)=>b.value-a.value)[0]:null;
    box.innerHTML=head+method+quality+cardsHtml+
      `<p class="insight-detail">ช่วงที่ใช้จริง ${result.start} ถึง ${result.end} · ${result.count} จุด NAV${hidden?'':result.maxDD<0?` · MDD: ยอด ${result.peakDate} → ต่ำสุด ${result.troughDate} · ${result.recoveryDate?'คืนยอด '+result.recoveryDate:'ยังไม่คืนยอดเดิมหลังจุดต่ำสุด'}`:' · ไม่มี Drawdown ในช่วงนี้'}</p>`+
      (hidden?'<p class="insight-empty">ซ่อนกราฟ ตาราง และสัดส่วนตามโหมดความเป็นส่วนตัว</p>':
      `<div class="insight-chart"><canvas id="insight-drawdown" role="img" aria-label="กราฟ Drawdown ของพอร์ตจำลอง"></canvas></div>
      <div class="insight-allocation"><h3>การกระจุกตัวตามแผนที่ถือ</h3><p>${largest?`${esc(largest.name)} มีสัดส่วนสูงสุด ${pct(largest.value/total)} · ถือ ${holdings.length} แผน`:'NAV ล่าสุดไม่ครบทุกแผน จึงยังประเมินสัดส่วนไม่ได้'}</p><small>สัดส่วนรายแผนอาจมีสินทรัพย์ซ้ำกัน จึงไม่เท่ากับการกระจายสินทรัพย์จริง</small></div>
      <h3 class="insight-subtitle">ผลตอบแทนรายเดือนของพอร์ตจำลอง</h3><div class="insight-months">${M.monthly(points).map(m=>`<div><span>${m.month}${m.partial?' *':''}</span><strong>${pct(m.value)}</strong></div>`).join('')}</div><p class="insight-detail">* เดือนแรกเริ่มจาก NAV จุดแรกของช่วง เดือนสุดท้ายถึงข้อมูลล่าสุด อาจไม่เต็มเดือน</p>
      <h3 class="insight-subtitle">เปรียบเทียบแต่ละแผน</h3><p class="insight-detail">แต่ละแถวใช้วันที่ที่ทั้งพอร์ตและแผนนั้นมีข้อมูลร่วมกัน ส่วนต่าง = ผลตอบแทนพอร์ต − ผลตอบแทนแผน (จุดเปอร์เซ็นต์) ไม่ใช่คำแนะนำเลือกแผน</p>
      <div class="table-responsive"><table><thead><tr><th>แผนลงทุน</th><th>ผลตอบแทน</th><th>Max DD</th><th>ผันผวน/ปี</th><th>ส่วนต่างพอร์ต (pp)</th><th>ช่วงร่วมกัน</th></tr></thead><tbody>${comparison}</tbody></table></div>`)+
      `<details class="insight-notes"><summary>วิธีคำนวณและข้อจำกัดข้อมูล</summary><p>Drawdown = มูลค่าจำลอง ÷ ค่าสูงสุดสะสม − 1; Max Drawdown คือค่าต่ำสุดของ Drawdown; ผลตอบแทน = มูลค่าสุดท้าย ÷ ค่าเริ่มต้น − 1; การคืนยอด = ค่าสูงสุด ÷ ค่าล่าสุด − 1</p><p>ข้ามวัน NAV ว่าง ศูนย์ หรือติดลบทั้งแถวเมื่อแผนที่ถือมีข้อมูลไม่ครบ ไม่เติมราคาแทน ความผันผวนใช้ sample SD ของ simple returns และสมมติ 252 ช่วงต่อปี หากข้อมูลเว้นวัน ผลตอบแทนแต่ละช่วงอาจครอบคลุมหลายวันและค่า annualized อาจคลาดเคลื่อน</p><p>ยังไม่แสดง Sharpe, Beta และผลตอบแทนบัญชีจริง เพราะต้องกำหนดอัตราปลอดความเสี่ยง benchmark และมีประวัติหน่วย/ธุรกรรมครบก่อน เงินนำส่งไม่ใช่กำไร ข้อมูลนี้วิเคราะห์ย้อนหลัง ไม่พยากรณ์ผลตอบแทน</p><p>อ้างอิงวิธี: <a href="https://help.portfolio-performance.info/en/reference/view/reports/performance/" target="_blank" rel="noopener">Portfolio Performance</a></p></details>`;
    if(!hidden&&typeof Chart!=='undefined')chart=new Chart(document.getElementById('insight-drawdown'),{type:'line',data:{labels:result.curve.map(p=>p.date),datasets:[{label:'Drawdown (%)',data:result.curve.map(p=>p.dd*100),borderColor:'#bb4252',backgroundColor:'#bb425222',fill:true,pointRadius:0,tension:0}]},options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true}},scales:{y:{max:0,ticks:{callback:n=>n+'%'}},x:{ticks:{maxTicksLimit:7}}}}});
  }
})();
