/* Webull read-only view: missing, partial and verified zero are distinct states. */
(function(root){
  'use strict';
  function num(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;}
  function model(result){
    const accounts=Array.isArray(result?.accounts)?result.accounts:[];
    const verified=result?.schemaVersion==='webull-v2';
    const suspicious=!verified&&accounts.length>0&&accounts.every(a=>!(a.positions||[]).length&&['totalAssets','marketValue','cash'].every(k=>num(a.balance?.[k])===0));
    const currencies=[...new Set(accounts.map(a=>a.currency||a.balance?.currency).filter(Boolean))];
    const currency=currencies[0]||'USD';
    const selected=accounts.filter(a=>(a.currency||a.balance?.currency)===currency);
    const sum=key=>!suspicious&&selected.length&&selected.every(a=>a.balanceStatus!=='error'&&num(a.balance?.[key])!==null)?selected.reduce((s,a)=>s+num(a.balance[key]),0):null;
    const positions=accounts.flatMap(a=>(Array.isArray(a.positions)?a.positions:[]).map(p=>({...p,currency:p.currency||a.currency||currency})));
    const complete=verified&&accounts.length>0&&accounts.every(a=>a.balanceStatus==='ok'&&a.positionsStatus==='ok');
    const selectedPositions=positions.filter(p=>p.currency===currency);
    let pnl=sum('unrealizedPnl');
    if(pnl===null&&complete&&selectedPositions.every(p=>num(p.unrealizedPnl)!==null))pnl=selectedPositions.reduce((s,p)=>s+num(p.unrealizedPnl),0);
    return {accounts,positions,currency,currencies,suspicious,verified,complete,totals:{totalAssets:sum('totalAssets'),marketValue:sum('marketValue'),cash:sum('cash'),unrealizedPnl:pnl}};
  }
  const api={num,model};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.WebullView=api;
  root.formatWebullMoney=function(value,currency='USD'){
    if(typeof isMasked!=='undefined'&&isMasked)return currency+' ••••••';
    const n=num(value);if(n===null)return '—';
    try{return new Intl.NumberFormat('th-TH',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}catch(e){return currency+' '+n.toFixed(2);}
  };
  root.formatWebullNumber=function(value,digits=2){if(typeof isMasked!=='undefined'&&isMasked)return '••••';const n=num(value);return n===null?'—':n.toLocaleString('th-TH',{maximumFractionDigits:2});};
  root.renderPersonalWebullPortfolio=function(result){
    const section=document.getElementById('personalWebullSection');if(!section)return;
    if(!isMithongSession()){section.classList.add('hidden');return;}
    section.classList.remove('hidden');
    const content=document.getElementById('personalWebullContent'),message=document.getElementById('personalWebullMessage'),status=document.getElementById('personalWebullStatus');
    const show=text=>{message.textContent=text;message.className='mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800';};
    if(!result?.success){content.classList.add('hidden');show(result?.message||'อ่านข้อมูล Webull ไม่สำเร็จ กรุณาตรวจ backend');status.textContent='ยังอ่านยอดไม่ได้ · ไม่ใช่ยอดศูนย์';return;}
    const m=model(result);
    content.classList.remove('hidden');
    [['webullTotalAssets','totalAssets'],['webullMarketValue','marketValue'],['webullCash','cash'],['webullUnrealizedPnl','unrealizedPnl']].forEach(([id,k])=>{document.getElementById(id).textContent=formatWebullMoney(m.totals[k],m.currency);});
    const pnl=document.getElementById('webullUnrealizedPnl');pnl.className='text-lg font-black mt-1 '+(m.totals.unrealizedPnl===null?'text-slate-500':m.totals.unrealizedPnl>=0?'text-emerald-600':'text-rose-600');
    const masked=typeof isMasked!=='undefined'&&isMasked;
    const tbody=document.getElementById('personalWebullPositionsBody');
    tbody.innerHTML=m.positions.length?m.positions.map(p=>`<tr><td><strong>${escapeWebullText(p.symbol||'—')}</strong><div class="text-[10px] text-slate-500">${escapeWebullText(p.name||p.instrumentType||'')} · ${escapeWebullText(p.currency)}</div></td><td>${formatWebullNumber(p.quantity)}</td><td>${formatWebullMoney(p.averageCost,p.currency)}</td><td>${formatWebullMoney(p.lastPrice,p.currency)}</td><td>${formatWebullMoney(p.marketValue,p.currency)}</td><td>${formatWebullMoney(p.unrealizedPnl,p.currency)} (${masked?'••••':num(p.unrealizedPct)===null?'—':num(p.unrealizedPct).toFixed(2)+'%'})</td></tr>`).join(''):`<tr><td colspan="6" class="text-center py-5 text-slate-500">${m.complete?'Webull ยืนยันว่าไม่มีสถานะถือครอง':'ยังยืนยันรายการถือครองไม่ได้ ไม่สรุปว่าพอร์ตว่าง'}</td></tr>`;
    const issues=[];
    if(m.accounts.some(a=>a.balance?.totalAssetsMethod==='marketValuePlusCash'))issues.push('ยอดสินทรัพย์รวมคำนวณจากมูลค่าหลักทรัพย์ + เงินสด เพราะ API ไม่ส่งยอด Net Liquidation โดยตรง');
    if(m.suspicious)issues.push('backend รุ่นเดิมส่งยอดศูนย์และรายการว่างโดยไม่มีสถานะยืนยัน จึงแสดง — แทน 0 จนกว่าจะตรวจ API สำเร็จ');
    else if(!m.complete)issues.push('ข้อมูลยังไม่ครบหรือ backend ยังไม่รองรับการยืนยันสถานะ balance/positions');
    if(m.currencies.length>1)issues.push('ยอดสรุปแสดงเฉพาะ '+m.currency+' ไม่รวมข้ามสกุลเงิน');
    if(Array.isArray(result.errors)&&result.errors.length)issues.push(m.verified&&result.message?result.message:'มีคำขออ่านข้อมูลบางส่วนล้มเหลว');
    if(issues.length)show(issues.join(' · '));else message.classList.add('hidden');
    let fetched='—';if(result.fetchedAt&&!isNaN(Date.parse(result.fetchedAt)))fetched=new Date(result.fetchedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
    status.textContent=(m.complete?'อ่าน balance / positions สำเร็จ':m.suspicious?'ยังไม่ยืนยันยอด':'อ่านข้อมูลได้บางส่วน')+' · '+m.accounts.length+' บัญชี · '+m.positions.length+' รายการที่อ่านได้ · เรียกข้อมูล '+fetched;
  };
})(typeof window!=='undefined'?window:globalThis);
