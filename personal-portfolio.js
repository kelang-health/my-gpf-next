/* Private data is fetched after login. This public file contains no holdings. */
(function(root){
  'use strict';
  const num=v=>v===null||v===undefined||String(v).trim()===''?null:(Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null);
  const sum=a=>a.every(v=>num(v)!==null)?a.reduce((s,v)=>s+num(v),0):null;
  function sizeTrade(entry,stop,target,risk,fee,lot){
    if(![entry,stop,target,risk,fee,lot].every(Number.isFinite)||!(entry>stop&&stop>0&&target>entry&&risk>0&&fee>=0&&lot>0))return null;
    const quantity=Math.floor(Math.max(0,risk-fee)/(entry-stop)/lot)*lot;
    const loss=quantity*(entry-stop)+fee, reward=quantity*(target-entry)-fee;
    return {quantity,loss,reward,rr:loss>0?reward/loss:null,cost:entry*quantity};
  }
  function signal({price,stop,target,asOf,now=Date.now()}){
    const time=Date.parse(asOf), age=now-time;
    if(!(price>0)||!Number.isFinite(time)||age<0||age>86400000)return 'ข้อมูลไม่พอ / รอราคาที่ตรวจสอบ';
    if(!(stop>0&&target>stop))return 'ยังไม่มีแผนออกที่ครบ';
    if(price<=stop)return 'ทบทวนลด / ออก: ถึงจุดเสี่ยง';
    if(price>=target)return 'ทบทวนขายทำกำไร: ถึงเป้าหมาย';
    return 'ถือภายใต้แผน / ติดตาม';
  }
  function overlap(symbol){return ({GOOGL:'ALPHABET',GOOG:'ALPHABET',GOOG80:'ALPHABET',NVDA06:'NVIDIA',NVDA80:'NVIDIA',NVDA:'NVIDIA',MSFT06:'MICROSOFT',MSFT80:'MICROSOFT',MSFT:'MICROSOFT',AMZN06:'AMAZON',AMZN80:'AMAZON',AMZN:'AMAZON',AVGO80:'BROADCOM',AVGO:'BROADCOM',GLD:'GOLD',IAU:'GOLD',IAUI:'GOLD'})[symbol]||symbol;}
  const api={num,sum,sizeTrade,signal,overlap};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.PersonalPortfolio=api;
  let nav=null, data=null, webull=null, epoch=0, loaded=false, busy=false;
  let plan={maxLoss:50,years:null,monthly:null,risk:null,weekly:null,monthlyStop:null,targets:[],roles:{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hidden=()=>typeof isMasked!=='undefined'&&isMasked;
  const money=(v,c='THB')=>hidden()?'••••':num(v)===null?'ยังไม่ทราบ':new Intl.NumberFormat('th-TH',{style:'currency',currency:c,maximumFractionDigits:2}).format(num(v));
  const rows=x=>x?.available&&Array.isArray(x.rows)?x.rows.slice(1):[];
  const roleName={retirement:'เกษียณระยะยาว',medium:'ระยะกลาง',swing:'เก็งกำไรระยะสั้น',cash:'เงินสด',unassigned:'รอจัดกลยุทธ์'};
  let actionsBound=false;
  function mount(){
    let box=document.getElementById('personal-portfolio');if(box)return box;
    box=document.createElement('section');box.id='personal-portfolio';box.className='pastel-card pp';
    document.getElementById('page-portfolio').prepend(box);
    if(!actionsBound){actionsBound=true;
    const eventHost=document.getElementById('main-app')||document;
    eventHost.addEventListener('click',async e=>{
      if(e.target.id==='pp-refresh'){const ticket=epoch;await load(true);if(ticket===epoch&&isMithongSession()){await loadPersonalWebullPortfolio(true);const r=await callBackend('getNavData');if(ticket===epoch&&isMithongSession())root.processData(r);}}
      if(e.target.id==='pp-save')await save();
      if(e.target.id==='pp-calc')calculate();
      if(e.target.dataset.dimeEdit)openDimeEditor(e.target.dataset.dimeEdit);
      if(e.target.id==='pp-dime-save')await saveDime();
      if(e.target.id==='pp-dime-cancel')document.getElementById('pp-dime-editor')?.remove();
    });
    eventHost.addEventListener('change',e=>{if(e.target.dataset.position){plan.roles[e.target.dataset.position]=e.target.value;document.getElementById('pp-feedback').textContent='เปลี่ยนกลยุทธ์แล้ว กดบันทึกแผนเพื่อเก็บในบัญชี';}});}
    return box;
  }
  function parse(){
    const positions=[],accounts=[];
    if(nav?.headers&&nav?.data&&root.GpfMath){
      const prepared=GpfMath.prepare(nav.headers,nav.data),latest=prepared.rows.at(-1);let values=[],missing=[];
      Object.entries(nav.myUnits||{}).forEach(([name,u])=>{if(num(u)>0){const i=nav.headers.indexOf(name),v=i>0&&latest?num(latest.values[i]):null;if(!(v>0))missing.push(name);else{values.push(v*num(u));positions.push({key:'GPF:'+name,broker:'กบข.',symbol:name,currency:'THB',value:v*num(u),date:latest.date,role:'retirement',price:v,quantity:num(u)});}}});
      accounts.push({name:'กบข.',value:values.length&&!missing.length?sum(values):null,cash:null,date:latest?.date||'—',note:missing.length?'NAV ไม่ครบทุกแผน':'มูลค่าหน่วยปัจจุบัน × NAV; เงินสดนอกกองทุนไม่ทราบ'});
    }
    const dr=rows(data?.dime),summary=rows(data?.dimeSummary),sv=label=>summary.find(r=>r[0]===label)?.[1];
    const dimeDate=sv('วันที่ข้อมูล')||'—';
    const seen=new Set();
    const adjustments=rows(data?.dimeAdjustments).filter(r=>r[1]==='mithong');
    dr.forEach(r=>{const key='Dime:'+r[0]+':'+r[2]+':'+r[3];if(seen.has(key))return;seen.add(key);const edit=adjustments.find(a=>a[0]===key),q=edit?num(edit[2]):num(r[5]),price=num(r[7]);positions.push({key,broker:'Dime',symbol:r[3],currency:r[2],value:edit?(q===0?0:price!==null&&q!==null?q*price:null):num(r[8]),quantity:q,price,date:edit?edit[3]:r[0],priceDate:r[0],manual:!!edit,role:plan.roles[key]||'unassigned',note:edit?(q===0?'ปิดสถานะ (0 หุ้น) · ':'')+'จำนวนที่แก้ไขเอง × ราคาอ้างอิง statement '+r[0]+'; ไม่ใช่มูลค่าตลาดล่าสุด':''});});
    accounts.push({name:'Dime',value:adjustments.length?null:num(sv('รวมสองบัญชีเทียบบาท')),cash:adjustments.length?null:sum([sv('เงินสดต่างประเทศเทียบบาท'),sv('เงินสดบัญชีไทย')]),date:adjustments.length?adjustments.map(r=>r[3]).sort().at(-1):dimeDate,note:adjustments.length?'แก้จำนวนหุ้นแล้ว; ยอดรวมและเงินสดรอยืนยัน ไม่รวมยอด statement เดิมเป็นยอดปัจจุบัน':'ยอดย้อนหลัง รวมเงินสด ใช้ FX ตาม statement ไม่ใช่ FX ปัจจุบัน'});
    if(webull?.success&&root.WebullView){
      const m=WebullView.model(webull),th=m.currency==='THB'&&m.currencies.length===1;
      accounts.push({name:'Webull',value:th?m.totals.totalAssets:null,cash:th?m.totals.cash:null,date:webull.fetchedAt||'—',note:m.complete?'อ่านจาก API; เวลาเรียกข้อมูลอาจต่างจากเวลาราคา':'ข้อมูลบางส่วน / สกุลเงินยังรวมไม่ได้'});
      m.positions.forEach(p=>{const key='Webull:'+(p.account||'')+':'+p.symbol+':'+p.currency;positions.push({...p,key,broker:'Webull',symbol:p.symbol,currency:p.currency,value:num(p.marketValue),price:num(p.lastPrice),date:webull.fetchedAt,role:plan.roles[key]||'unassigned'});});
    }else accounts.push({name:'Webull',value:null,cash:null,date:'—',note:'ยังอ่าน API ไม่สำเร็จ ไม่ถือเป็นยอดศูนย์'});
    // Folio is a historical position ledger, not evidence that a sale has occurred.
    const folio=rows(data?.folio),fv=label=>folio.find(r=>r[1]===label)?.[2];
    const stocks=rows(data?.stocks).filter(r=>r[1]?.trim().toLowerCase()==='mithong');
    let cost=0;
    stocks.forEach(r=>{if(num(r[7])>0&&num(r[8])>0&&num(r[9])!==null){const key='Folio:'+r[0];cost+=num(r[7])*num(r[8])+num(r[9]);positions.push({key,broker:'Folio',symbol:r[2],currency:r[4],quantity:num(r[7]),value:null,price:null,date:r[6],role:plan.roles[key]||'swing',note:'ยืนยันต้นทุนซื้อ แต่ยังไม่ยืนยันยอดถือปัจจุบัน'});}});
    accounts.push({name:'Folio',value:null,cash:null,date:stocks.map(r=>r[6]).sort().at(-1)||'—',note:stocks.length?'ต้นทุนซื้อ '+money(cost)+'; ต้องตรวจยอดถือ / เงินสดปัจจุบัน':'ยังไม่มีข้อมูลรายการซื้อ'});
    return {accounts,positions,folio,challenge:data?.challenge};
  }
  function render(){
    if(!isMithongSession())return;
    const box=mount();
    if(hidden()){box.innerHTML='<header class="pp-head"><div><span class="pp-eyebrow">MY PERSONAL PORTFOLIO</span><h2>พอร์ตของฉัน</h2><p>ซ่อนยอด รายการถือครอง และแผนส่วนตัวตามโหมดความเป็นส่วนตัว</p></div></header>';document.dispatchEvent(new CustomEvent('personalportfolio:render',{detail:{masked:true}}));return;}
    const model=parse();
    const known=model.accounts.filter(a=>num(a.value)!==null),total=known.reduce((s,a)=>s+a.value,0),allKnown=known.length===model.accounts.length;
    const field=(key,label,unit,min=0,max=100000000)=>`<label>${label} (${unit})<input type="number" id="pp-${key}" min="${min}" max="${max}" step="any" value="${plan[key]??''}" placeholder="ยังไม่กำหนด"></label>`;
    const date=s=>{const d=Date.parse(s);return Number.isFinite(d)?new Date(d).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',...(String(s).length===10?{year:'numeric',month:'short',day:'numeric'}:{dateStyle:'short',timeStyle:'short'})}):esc(s);};
    const grouping={};model.positions.filter(p=>num(p.quantity)>0).forEach(p=>{const k=overlap(p.symbol);(grouping[k]||=[]).push(p);});
    const overlaps=Object.entries(grouping).filter(([,a])=>a.length>1);
    box.innerHTML=`<header class="pp-head"><div><span class="pp-eyebrow">MY PERSONAL PORTFOLIO</span><h2>พอร์ตของฉัน · ภาพรวมและแผนลงทุน</h2><p>กบข. ระยะยาว · Dime / Webull ระยะกลางและเก็งกำไร · จัดบทบาทแต่ละรายการก่อนเพิ่มความเสี่ยง</p></div><button id="pp-refresh" ${busy?'disabled':''}>${busy?'กำลังอ่านข้อมูล…':'อัปเดตข้อมูล'}</button></header>
      ${!data?'<p class="pp-alert">'+(loaded?'ยังอ่านฐานพอร์ตส่วนตัวไม่ได้ กรุณาลองอัปเดตข้อมูล':'กำลังเชื่อมฐานพอร์ตส่วนตัว…')+'</p>':''}
      <div class="pp-total"><div><small>${allKnown?'มูลค่ารวมจากข้อมูลที่มี':'ยอดย่อยที่อ่านมูลค่าได้ (ยังไม่ใช่ยอดรวมทั้งหมด)'}</small><strong>${known.length?money(total):'ยังไม่ทราบ'}</strong><p>ข้อมูลต่างวัน ${known.length}/${model.accounts.length} บัญชี · Dime ใช้ FX ณ สิ้นเดือน · Folio รอตรวจยอดล่าสุด</p></div><div><small>กรอบขาดทุนที่คุณระบุ</small><strong>${hidden()?'••••':plan.maxLoss??'—'}%</strong><p>ระดับความเสี่ยงที่ยอมรับ ไม่ใช่เป้าขาดทุนหรือคำสั่ง Stop</p></div></div>
      <div class="pp-accounts">${model.accounts.map(a=>`<article><h3>${a.name}</h3><strong>${money(a.value)}</strong><p>เงินสด ${money(a.cash)}</p><small>ข้อมูล ${date(a.date)}</small><p>${esc(a.note)}</p>${num(a.value)!==null&&total>0?`<div class="pp-bar"><span style="width:${100*a.value/total}%"></span></div><small>${hidden()?'••••':(100*a.value/total).toFixed(1)+'%'} ของยอดย่อยที่อ่านได้</small>`:''}</article>`).join('')}</div>
      <details open><summary>แผนส่วนตัวและสัดส่วนเป้าหมาย</summary><p class="pp-alert"><b>แผนร่างที่เสนอสำหรับเงินนอก กบข.:</b> ระยะกลาง 60% · เก็งกำไรระยะสั้น 25% · เงินสด 15% เพื่อแยกทุนลงทุนกับงบเทรดและเหลือเงินสำรอง ไม่ใช่สัดส่วนปัจจุบันหรือแผนที่ยืนยันแล้ว ต้องทบทวนตามระยะเวลา เงินเติม และยอดล่าสุดก่อนใช้จริง</p><div class="pp-fields">${field('years','ระยะเวลาพอร์ตระยะกลาง','ปี',0,80)}${field('monthly','เงินเติมพอร์ตส่วนตัว','บาท/เดือน')}${field('maxLoss','ขาดทุนชั่วคราวที่ยอมรับ','%',0,100)}${field('risk','งบเสี่ยงต่อรายการ','บาท')}${field('weekly','งบเสี่ยงต่อสัปดาห์','บาท')}${field('monthlyStop','ขาดทุนรายเดือนแล้วหยุดทบทวน','บาท')}</div>
      <p class="pp-note">คุณยืนยันรับความเสี่ยงสูงได้ 50%; ระยะเวลาและเงินเติมยังไม่กำหนด กฎ Folio เดิม 75–100 บาท/รายการ, 150 บาท/สัปดาห์, 400 บาท/เดือน ใช้เฉพาะ Folio จนกว่าจะกำหนดงบรวมใหม่</p>
      <h3>สัดส่วนเป้าหมายของพอร์ตทั้งหมด (%)</h3><div class="pp-fields">${['เกษียณ กบข.','ระยะกลาง','เก็งกำไรระยะสั้น','เงินสด'].map((s,i)=>`<label>${s}<input id="pp-target-${i}" type="number" min="0" max="100" step="any" placeholder="รอกำหนด" value="${plan.targets?.[i]??''}"></label>`).join('')}</div><p class="pp-note">เว้นว่างได้ หากกำหนดให้ครบต้องรวม 100% ระบบยังไม่แนะนำยอดซื้อขายเพื่อปรับสัดส่วนจนกว่าจะมียอดปัจจุบันครบ และจัดกลยุทธ์แต่ละรายการแล้ว</p><button id="pp-save">บันทึกแผนและกลยุทธ์ในบัญชี</button><p id="pp-feedback" role="status"></p></details>
      <details open><summary>รายการถือครองและบทบาทในพอร์ต (${model.positions.length})</summary><p class="pp-note">ชื่อเดียวกันต่างโบรกเกอร์ยังเป็นคนละสถานะ ตรวจยอดและวันที่ก่อนนำมารวม · สถานะจาก statement ไม่ยืนยันว่าถืออยู่วันนี้</p>${hidden()?'<p>ซ่อนรายการตามโหมดความเป็นส่วนตัว</p>':`<div class="pp-scroll"><table><thead><tr><th>บัญชี / สัญลักษณ์</th><th>กลยุทธ์</th><th>จำนวน</th><th>มูลค่า / สกุลเงิน</th><th>วันที่ข้อมูล</th><th>การดำเนินการ</th></tr></thead><tbody>${model.positions.map(p=>`<tr><td><strong>${esc(p.symbol)}</strong><small>${esc(p.broker)}</small></td><td>${p.role==='retirement'?'เกษียณระยะยาว':`<select aria-label="กลยุทธ์ ${esc(p.broker+' '+p.symbol)}" data-position="${esc(p.key)}">${['unassigned','medium','swing'].map(r=>`<option value="${r}" ${p.role===r?'selected':''}>${roleName[r]}</option>`).join('')}</select>`}</td><td>${(p.quantity==null?'—':GpfNumbers.fixed(p.quantity))}</td><td>${money(p.value,p.currency||'THB')}</td><td>${date(p.date)}</td><td>${p.broker==='Dime'?'<button type="button" data-dime-edit="'+esc(p.key)+'">แก้จำนวนหุ้น</button>':p.role==='retirement'?'ทบทวนแผนและสัดส่วนตามรอบ':'รอตรวจราคาปัจจุบัน / แผนออก'}${p.note?'<small>'+esc(p.note)+'</small>':''}</td></tr>`).join('')}</tbody></table></div>`}</details>
      <details open><summary>ความเสี่ยงจากสินทรัพย์ซ้ำ</summary>${hidden()?'<p>ซ่อนรายการตามโหมดความเป็นส่วนตัว</p>':overlaps.length?overlaps.map(([k,a])=>`<p><b>${esc(k)}</b> · ${a.map(p=>esc(p.broker+' / '+p.symbol)).join(' · ')}</p>`).join(''):'<p>ยังไม่พบรายการซ้ำจากข้อมูลที่อ่านได้</p>'}<p class="pp-note">ตรวจชื่อหุ้นและธีมพื้นฐานที่รู้จักเท่านั้น ยังไม่รวมสัดส่วนหุ้นภายใน ETF / กองทุน กบข. และ DR แต่ละตัวอาจมีอัตราแปลงต่างกัน จึงไม่บวกจำนวนหุ้นตรง ๆ</p></details>
      <details open><summary>แผนซื้อ · ถือ · ลด / ออก</summary><div class="pp-strategies"><article><h3>กบข. / ระยะยาว</h3><p>ทบทวนสัดส่วนทุกไตรมาส หรือเมื่อเป้าหมายชีวิตเปลี่ยน ใช้เงินนำส่งช่วยปรับสัดส่วน ตรวจสินทรัพย์ภายในแผนก่อนเปลี่ยนกองทุน</p></article><article><h3>ระยะกลาง</h3><p>ระบุเหตุผลลงทุน กรอบเวลา และเงื่อนไขที่ทำให้เหตุผลเปลี่ยน ทบทวนหลังงบและเหตุการณ์สำคัญ ตรวจว่าหุ้นตรงกับ DR / ETF ที่ถือซ้ำหรือไม่</p></article><article><h3>เก็งกำไรระยะสั้น</h3><p>ก่อนซื้อกำหนดราคาซื้อ จุดหยุดทบทวน เป้ากำไร และขนาดสถานะ รวมค่าธรรมเนียม งดเพิ่มสถานะเมื่อใช้งบเสี่ยงครบ</p></article></div><p>แผนเริ่มต้นที่เสนอ: แยกเงิน กบข. ออกจากงบเก็งกำไร จัดกลยุทธ์ Dime / Webull ให้ครบ แล้วกำหนดงบเสี่ยงรวมทั้งสองบัญชี โดยนับหุ้นและ DR ที่อ้างอิงบริษัทเดียวกันเป็นความเสี่ยงกลุ่มเดียว</p><p>${hidden()?'':num(plan.maxLoss)>0&&num(plan.maxLoss)<100?'หากพอร์ตลดลง '+plan.maxLoss+'% ต้องได้ผลตอบแทน '+(100/(1-plan.maxLoss/100)-100).toFixed(1)+'% จากยอดที่เหลือจึงกลับทุนเดิม':''}</p><p class="pp-alert">ขณะนี้ยังไม่มีราคา Bid/Ask พร้อมเวลาของทุกสถานะ จึงยังไม่ออกสัญญาณ BUY อัตโนมัติ การถึง Stop / เป้าเป็นสัญญาณให้ทบทวน ไม่ใช่หลักฐานการขายสำเร็จ</p>
      <h3>จำลองขนาดสถานะและจุดทบทวน (ไม่ส่งคำสั่งซื้อขาย)</h3><div class="pp-fields">${[['entry','ราคาเข้าซื้อ'],['stop','จุดทบทวนขาดทุน'],['target','เป้าหมายขาย'],['budget','งบขาดทุนต่อรายการ'],['fee','ค่าธรรมเนียมไป–กลับรวม'],['lot','จำนวนต่อหน่วยซื้อขาย'],['price','ราคาที่ตรวจสอบล่าสุด']].map(([k,l])=>`<label>${l}<input id="pp-trade-${k}" type="number" min="0" step="any" placeholder="กรอกค่า"></label>`).join('')}<label>วันเวลาราคาที่ตรวจสอบ (เวลาไทย)<input id="pp-trade-time" type="datetime-local"></label></div><p class="pp-note">ใช้ราคาและงบสกุลเงินเดียวกัน ตรวจค่าธรรมเนียมจริงและ Board lot / เศษหุ้นกับโบรกเกอร์ จุด Stop อาจขายจริงได้ต่ำกว่าแผน</p><button id="pp-calc">ประเมินแผน</button><p id="pp-calc-result" role="status"></p></details>
      <footer class="pp-note">แผนนี้เป็นเครื่องมือประกอบการตัดสินใจ ไม่คาดการณ์ผลตอบแทน ไม่รับประกันกำไร · <a href="https://www.investor.gov/introduction-investing/getting-started/asset-allocation" target="_blank" rel="noopener">แนวทางจัดสัดส่วนและกระจายความเสี่ยง SEC Investor.gov</a></footer>`;
    document.dispatchEvent(new CustomEvent('personalportfolio:render',{detail:{...model,masked:false}}));
  }
  async function load(force=false){
    if(!isMithongSession()||busy)return;const ticket=epoch;busy=true;render();
    try{const r=await callBackend('getPersonalPortfolio');if(ticket!==epoch||!isMithongSession())return;if(!r?.success)throw Error(r?.message||'ยังอ่านฐานไม่ได้');data=r;loaded=true;if(r.plan)plan={...plan,...r.plan,roles:r.plan.roles||{}};}
    catch(e){if(ticket===epoch){loaded=true;data=null;}}
    finally{if(ticket===epoch){busy=false;render();}}
  }
  async function save(){
    const ticket=epoch,button=document.getElementById('pp-save'),msg=document.getElementById('pp-feedback');button.disabled=true;
    const draft={...plan};for(const k of ['years','monthly','maxLoss','risk','weekly','monthlyStop'])draft[k]=num(document.getElementById('pp-'+k).value);
    draft.targets=[0,1,2,3].map(i=>num(document.getElementById('pp-target-'+i).value));
    try{const result=await callBackend('savePersonalPlan',{plan:draft});if(ticket!==epoch||!isMithongSession())return;if(!result.success)throw Error(result.message);plan=result.plan;msg.textContent='บันทึกแผนในบัญชีแล้ว';}catch(e){if(ticket===epoch)msg.textContent=e.message||'บันทึกไม่สำเร็จ';}finally{if(ticket===epoch)button.disabled=false;}
  }
  function openDimeEditor(key){
    if(hidden()||!isMithongSession())return;
    const p=parse().positions.find(p=>p.key===key&&p.broker==='Dime');if(!p)return;
    document.getElementById('pp-dime-editor')?.remove();
    const form=document.createElement('section');form.id='pp-dime-editor';form.className='pp-alert';
    form.innerHTML=`<h3>แก้จำนวนหุ้น Dime · ${esc(p.symbol)}</h3><p>กรอกจำนวนคงเหลือทั้งหมด รองรับเศษหุ้น ใส่ 0 เมื่อปิดสถานะ เก็บแยกจาก statement; ไม่คำนวณเงินสดหรือกำไรขายจริงอัตโนมัติ</p><div class="pp-fields"><label>จำนวนคงเหลือ<input id="pp-dime-quantity" type="number" min="0" max="1000000000000" step="any" value="${p.quantity}"></label><label>วันที่ยืนยันจำนวน<input id="pp-dime-date" type="date" max="${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())}" value="${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date())}"></label></div><button id="pp-dime-save">บันทึกจำนวนหุ้น</button><button id="pp-dime-cancel">ยกเลิก</button><p id="pp-dime-feedback" role="status"></p>`;
    form.dataset.key=key;form.dataset.expected=p.quantity;(document.getElementById('page-personal')&&!document.getElementById('page-personal').classList.contains('hidden')?document.getElementById('personal-details'):mount()).prepend(form);form.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('pp-dime-quantity').focus();
  }
  async function saveDime(){
    const form=document.getElementById('pp-dime-editor');if(!form||hidden()||!isMithongSession())return;
    const q=num(document.getElementById('pp-dime-quantity').value),day=document.getElementById('pp-dime-date').value,msg=document.getElementById('pp-dime-feedback'),button=document.getElementById('pp-dime-save');
    if(q===null||q<0||q>1e12||!day){msg.textContent='กรอกจำนวนตั้งแต่ 0 และวันที่ยืนยัน';return;}
    const ticket=epoch;button.disabled=true;msg.textContent='กำลังบันทึก…';
    try{const r=await callBackend('saveDimeQuantity',{key:form.dataset.key,quantity:q,asOf:day,expectedQuantity:Number(form.dataset.expected)});if(ticket!==epoch||!isMithongSession())return;if(!r.success)throw Error(r.message||'บันทึกไม่สำเร็จ');await load(true);const box=mount(),notice=document.createElement('p');notice.className='pp-alert';notice.setAttribute('role','status');notice.textContent='บันทึกจำนวนหุ้น Dime แล้ว · มูลค่าใช้ราคา statement เดิม เงินสดและยอดรวมรอยืนยัน';(document.getElementById('page-personal')&&!document.getElementById('page-personal').classList.contains('hidden')?document.getElementById('personal-details'):box).prepend(notice);}
    catch(e){if(ticket===epoch){msg.textContent=e.message||'บันทึกไม่สำเร็จ';button.disabled=false;}}
  }
  function calculate(){
    const v=k=>num(document.getElementById('pp-trade-'+k).value),r=sizeTrade(v('entry'),v('stop'),v('target'),v('budget'),v('fee'),v('lot')),out=document.getElementById('pp-calc-result');
    if(hidden()){out.textContent='ปิดโหมดซ่อนยอดเพื่อประเมินแผน';return;}
    if(!r){out.textContent='กรอกทุกช่อง โดยราคาเข้า > Stop > 0 และเป้าหมาย > ราคาเข้า; ระบุค่าธรรมเนียมรวมและหน่วยซื้อขาย';return;}
    const t=document.getElementById('pp-trade-time').value;
    out.textContent=`จำนวนตามงบเสี่ยง ${r.quantity.toLocaleString()} หน่วย · เงินซื้อก่อนค่าธรรมเนียม ${r.cost.toFixed(2)} · ขาดทุนตามแผน ${r.loss.toFixed(2)} · กำไรตามเป้า ${r.reward.toFixed(2)} · Reward/Risk ${r.rr?.toFixed(2)??'—'} · ${signal({price:v('price'),stop:v('stop'),target:v('target'),asOf:t?t+':00+07:00':''})}${r.quantity===0?' · งบไม่พอสำหรับหนึ่งหน่วยซื้อขาย':''} · ต้องตรวจเงินสดและความเสี่ยงรวมก่อนซื้อ`;
  }
  const originalProcess=root.processData;
  root.processData=function(r){nav=r?.headers&&r?.data?{headers:r.headers.slice(),data:r.data.map(a=>a.slice()),myUnits:{...r.myUnits}}:null;const ret=originalProcess.apply(this,arguments);if(isMithongSession()){render();if(!loaded)load();}return ret;};
  const originalWebull=root.renderPersonalWebullPortfolio;
  root.renderPersonalWebullPortfolio=function(r){const ret=originalWebull.apply(this,arguments);if(isMithongSession()){webull=r;render();}return ret;};
  const originalPrivacy=root.togglePrivacy;
  root.togglePrivacy=function(){const ret=originalPrivacy.apply(this,arguments);if(isMithongSession())render();return ret;};
  const originalLogout=root.logout;
  root.logout=function(){epoch++;nav=data=webull=null;busy=loaded=false;plan={maxLoss:50,targets:[],roles:{}};document.getElementById('personal-portfolio')?.remove();return originalLogout.apply(this,arguments);};
})(typeof window!=='undefined'?window:globalThis);
