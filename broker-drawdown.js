/* Account DD uses private confirmed snapshots; never persist holdings in public assets. */
(function(root){
 'use strict';
 function metrics(rows){
  const points=rows.slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(points.length<2)return null;
  let index=100,peak=100,maxDD=0,peakDate=points[0].date,maxPeak=peakDate,trough=peakDate;
  const curve=[{date:peakDate,dd:0}];
  for(let i=1;i<points.length;i++){
   const prev=points[i-1],p=points[i];
   if(!(prev.equity>0&&Number.isFinite(p.equity)&&Number.isFinite(p.netFlow)&&p.equity-p.netFlow>0))return null;
   index*=((p.equity-p.netFlow)/prev.equity);
   if(!Number.isFinite(index)||index<=0)return null;
   if(index>=peak){peak=index;peakDate=p.date;}
   const dd=index/peak-1;
   if(dd<maxDD){maxDD=dd;maxPeak=peakDate;trough=p.date;}
   curve.push({date:p.date,dd});
  }
  return {currentDD:index/peak-1,maxDD,recovery:peak/index-1,curve,peakDate:maxPeak,troughDate:trough};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={metrics};return;}
 let history=[],accounts=[],loaded=false,loading=false,epoch=0,charts=[],notice='';
 const selected={Dime:'THB',Webull:'THB'};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const masked=()=>typeof isMasked!=='undefined'&&isMasked;
 const owner=()=>typeof isMithongSession==='function'&&isMithongSession();
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date());
 const fmt=v=>GpfNumbers.fixed(v);
 const pct=v=>fmt(v*100)+'%';
 function destroy(){charts.forEach(c=>c.destroy());charts=[];}
 function mount(){
  let box=document.getElementById('broker-drawdown');if(box)return box;
  const intro=document.getElementById('personal-intro');if(!intro)return null;
  box=document.createElement('section');box.id='broker-drawdown';box.className='pastel-card pp broker-dd';intro.after(box);
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.ddReload!==undefined)load(true);if(b.dataset.ddSuggest) suggest(b.dataset.ddSuggest);if(b.dataset.ddEdit)edit(b.dataset.ddEdit,b.dataset.ddDate);});
  box.addEventListener('change',e=>{if(e.target.dataset.ddCurrency){selected[e.target.dataset.ddCurrency]=e.target.value;render();}if(e.target.name==='date')fillExisting(e.target.closest('form'));});
  box.addEventListener('submit',e=>{e.preventDefault();save(e.target);});
  return box;
 }
 async function load(force=false){
  if(!owner()||loading||(!force&&loaded))return;
  const ticket=epoch;loading=true;notice='';render();
  try{const r=await callBackend('getPortfolioDrawdown');if(ticket!==epoch||!owner())return;if(!r.success)throw Error(r.message||'อ่านประวัติ DD ไม่สำเร็จ');history=r.history||[];loaded=true;}
  catch(e){if(ticket===epoch)notice=e.message;}
  finally{if(ticket===epoch){loading=false;render();}}
 }
 function panel(broker){
  const currency=selected[broker],rows=history.filter(r=>r.broker===broker&&r.currency===currency).sort((a,b)=>a.date.localeCompare(b.date));
  const m=metrics(rows),last=rows.at(-1);
  return `<article class="dd-account"><header><h3>${broker} · Drawdown</h3><label>สกุลเงิน <select data-dd-currency="${broker}" aria-label="สกุลเงิน DD ${broker}"><option ${currency==='THB'?'selected':''}>THB</option><option ${currency==='USD'?'selected':''}>USD</option></select></label></header>
   <div class="dd-stats"><div><small>Current DD</small><strong>${m?pct(m.currentDD):'—'}</strong></div><div><small>Max DD</small><strong>${m?pct(m.maxDD):'—'}</strong></div><div><small>ผลตอบแทนเพื่อคืนยอด</small><strong>${m?pct(m.recovery):'—'}</strong></div></div>
   <p>${last?`ยอดยืนยันล่าสุด ${fmt(last.equity)} ${currency} · ${esc(last.date)}`:'ยังไม่มีประวัติยอดรวมที่ยืนยัน'}</p><p class="pp-note">${rows.length} จุดข้อมูล${rows.length?' · '+esc(rows[0].date)+' ถึง '+esc(last.date):''}${m&&m.maxDD<0?' · MDD: '+esc(m.peakDate)+' → '+esc(m.troughDate):''}</p>
   ${m?`<div class="dd-chart"><canvas id="dd-chart-${broker}" role="img" aria-label="กราฟ DD ${broker}"></canvas></div>`:`<p class="pp-alert">${loading?'กำลังอ่านประวัติ…':'ต้องมีอย่างน้อย 2 วันในสกุลเงินเดียวกัน จึงคำนวณ DD ได้ ไม่ถือว่าข้อมูลว่างเป็น DD 0%'}</p>`}
   <details><summary>บันทึก / แก้ไขยอดรวม ${broker}</summary><p class="pp-note">ใช้มูลค่าหลักทรัพย์ + เงินสด − หนี้ ของบัญชีทั้งหมดในสกุลเงินที่เลือก ไม่ใช้ต้นทุนซื้อหรือกำไรค้างแทนยอดรวม</p>
   <form data-dd-form="${broker}"><div class="pp-fields"><label>วันที่ยอดบัญชี<input name="date" type="date" required max="${today()}" value="${today()}"></label><label>ยอดรวม (${currency})<input name="equity" type="number" required min="0.00000001" max="1000000000000" step="any"></label><label>เงินเข้าออกสุทธิตั้งแต่จุดก่อน (${currency})<input name="netFlow" type="number" required min="-1000000000000" max="1000000000000" step="any" placeholder="ฝาก + / ถอน − / ไม่มี 0"></label></div><p class="pp-note">วันแรกกรอกเงินเข้าออก 0 เป็นฐาน · ซื้อขายภายในบัญชีและปันผลที่อยู่ในบัญชีไม่ใช่เงินฝากภายนอก</p><button type="button" data-dd-suggest="${broker}">เติมยอดอ้างอิงจากข้อมูลพอร์ต</button><label class="dd-confirm"><input type="checkbox" name="confirmed" required> ยืนยันยอดรวม วันที่ และเงินเข้าออกครบถ้วนแล้ว</label><button type="submit" ${loading||!loaded?'disabled':''}>บันทึกยอด ${broker}</button><p data-dd-feedback role="status"></p></form></details>
   <details><summary>ประวัติที่ใช้คำนวณ (${rows.length})</summary><div class="pp-scroll"><table><thead><tr><th>วันที่</th><th>ยอดรวม</th><th>เงินเข้าออก</th><th>จัดการ</th></tr></thead><tbody>${rows.slice().reverse().map(r=>`<tr><td>${esc(r.date)}</td><td>${fmt(r.equity)}</td><td>${fmt(r.netFlow)}</td><td><button data-dd-edit="${broker}" data-dd-date="${esc(r.date)}">แก้ไข</button></td></tr>`).join('')||'<tr><td colspan="4">ยังไม่มีประวัติ</td></tr>'}</tbody></table></div></details></article>`;
 }
 function render(){
  destroy();if(!owner()){document.getElementById('broker-drawdown')?.remove();return;}
  const box=mount();if(!box)return;
  if(masked()){box.innerHTML='<h2>Drawdown · Dime / Webull</h2><p>ซ่อนประวัติยอดบัญชีและกราฟตามโหมดความเป็นส่วนตัว</p>';return;}
  box.innerHTML=`<div class="pp-head"><div><span class="pp-eyebrow">ACCOUNT RISK / แยกรายพอร์ต</span><h2>Drawdown · Dime & Webull</h2></div><button data-dd-reload ${loading?'disabled':''}>${loading?'กำลังโหลด…':'โหลดประวัติใหม่'}</button></div><p>วัดการลดลงจากจุดสูงสุดของดัชนีผลตอบแทนที่ปรับเงินเข้าออก แยกแต่ละบัญชีและสกุลเงิน</p>${notice?`<p role="status" class="pp-alert">${esc(notice)}</p>`:''}<div class="dd-grid">${['Dime','Webull'].map(panel).join('')}</div><details><summary>วิธีคำนวณ / ข้อจำกัด</summary><p>ดัชนีเริ่ม 100; ดัชนีใหม่ = ดัชนีก่อน × (ยอดรวมใหม่ − เงินเข้าออกสุทธิ) ÷ ยอดรวมก่อน; DD = ดัชนี ÷ จุดสูงสุดสะสม − 1; Max DD = DD ต่ำสุด</p><p>สมมติเงินเข้าออกเกิดปลายช่วง จึงเป็นค่าประมาณเมื่อมีเงินเคลื่อนย้ายระหว่างวัน ไม่ใช่ TWR ที่ตรวจธุรกรรมครบ กราฟวัดเฉพาะวันที่บันทึก อาจพลาดจุดต่ำสุดระหว่างวันหรือวันที่ไม่มีข้อมูล หากบันทึกเป็น THB ผลของอัตราแลกเปลี่ยนรวมอยู่ด้วย ห้ามรวม THB และ USD ตรง ๆ</p><p>ยอด Dime เดิมเป็น statement ย้อนหลัง และ Webull เป็นภาพ ณ เวลาเรียก API จึงไม่สร้างประวัติย้อนหลังหรือกำหนดเงินเข้าออกเป็น 0 อัตโนมัติ ประวัติเก็บในบัญชีเจ้าของบนเซิร์ฟเวอร์ ไม่รวมกับ กบข. หรือ Challenge</p></details>`;
  if(typeof Chart!=='undefined')for(const broker of ['Dime','Webull']){const m=metrics(history.filter(r=>r.broker===broker&&r.currency===selected[broker]));if(m)charts.push(new Chart(document.getElementById('dd-chart-'+broker),{type:'line',data:{labels:m.curve.map(p=>p.date),datasets:[{label:broker+' DD (%)',data:m.curve.map(p=>p.dd*100),borderColor:broker==='Dime'?'#0891b2':'#7c3aed',backgroundColor:broker==='Dime'?'#0891b222':'#7c3aed22',fill:true,pointRadius:3,tension:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{tooltip:{callbacks:{label:c=>pct(c.raw/100)}}},scales:{y:{max:0,ticks:{callback:v=>fmt(v)+'%'}},x:{ticks:{maxTicksLimit:5}}}}}));}
 }
 function formFor(broker){return document.querySelector(`[data-dd-form="${broker}"]`);}
 function fillExisting(form){
  if(!form)return;const broker=form.dataset.ddForm,r=history.find(r=>r.broker===broker&&r.currency===selected[broker]&&r.date===form.elements.date.value);
  form.elements.equity.value=r?.equity??'';form.elements.netFlow.value=r?.netFlow??'';form.elements.confirmed.checked=false;form.dataset.revision=r?.revision||'';
 }
 function edit(broker,date){const form=formFor(broker);form.closest('details').open=true;form.elements.date.value=date;fillExisting(form);form.scrollIntoView({behavior:'smooth',block:'center'});}
 function suggest(broker){
  const form=formFor(broker),a=accounts.find(a=>a.name===broker),msg=form.querySelector('[data-dd-feedback]');
  if(selected[broker]!=='THB'||!a||!Number.isFinite(a.value)||a.value<=0){msg.textContent='ยังไม่มียอดรวมครบในสกุลเงินนี้ กรุณาตรวจยอดบัญชีจริงแล้วกรอกเอง';return;}
  const iso=String(a.date||'');const day=/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:Number.isFinite(Date.parse(iso))?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date(iso)):'';
  if(!day||day>today()){msg.textContent='ไม่พบวันที่ยอดที่ตรวจสอบได้ กรุณากรอกจาก statement';return;}
  form.elements.date.value=day;fillExisting(form);form.elements.equity.value=a.value;form.elements.confirmed.checked=false;msg.textContent='เติมยอดอ้างอิงแล้ว โปรดตรวจวันที่และเงินเข้าออกก่อนยืนยันบันทึก';
 }
 async function save(form){
  if(!owner()||masked()||loading||!loaded||!form.reportValidity())return;
  const broker=form.dataset.ddForm,currency=selected[broker],ticket=epoch,msg=form.querySelector('[data-dd-feedback]'),button=form.querySelector('[type=submit]');
  const date=form.elements.date.value,existing=history.find(r=>r.broker===broker&&r.currency===currency&&r.date===date);
  const params={broker,currency,date,equity:Number(form.elements.equity.value),netFlow:Number(form.elements.netFlow.value),confirmed:form.elements.confirmed.checked,expectedRevision:form.dataset.revision||''};
  if(existing&&!params.expectedRevision){msg.textContent='มีข้อมูลวันนี้แล้ว กดแก้ไขในประวัติก่อนเพื่อป้องกันเขียนทับโดยไม่ตั้งใจ';return;}
  button.disabled=true;msg.textContent='กำลังบันทึก…';
  try{const r=await callBackend('savePortfolioSnapshot',params);if(ticket!==epoch||!owner())return;if(!r.success)throw Error(r.message||'บันทึกไม่สำเร็จ');history=r.history||[];notice='บันทึกยอด '+broker+' แล้ว';render();}
  catch(e){if(ticket===epoch)msg.textContent=e.message;}
  finally{button.disabled=false;}
 }
 document.addEventListener('personalportfolio:render',e=>{accounts=e.detail.accounts||accounts;render();load();});
 const oldPrivacy=root.togglePrivacy;root.togglePrivacy=function(){const r=oldPrivacy.apply(this,arguments);render();return r;};
 const oldLogout=root.logout;root.logout=function(){epoch++;history=[];accounts=[];loaded=false;loading=false;notice='';destroy();document.getElementById('broker-drawdown')?.remove();return oldLogout.apply(this,arguments);};
})(typeof window!=='undefined'?window:globalThis);
