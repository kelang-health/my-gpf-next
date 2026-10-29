(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let snapshot=null,stockTab='gpf',watch=[],personalFilter='all',quoteRequest=0;
 const privateMode=()=>typeof isMasked!=='undefined'&&isMasked;
 const amount=(n,c='THB')=>privateMode()?'••••':n===null||n===undefined?'ยังไม่ทราบ':new Intl.NumberFormat('th-TH',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
 function personalPage(){
  let p=document.getElementById('page-personal');if(p)return p;
  p=document.createElement('div');p.id='page-personal';p.className='hidden space-y-6';
  p.innerHTML='<section id="personal-intro" class="pastel-card pp"><h2>พอร์ตส่วนตัว · ระยะสั้นและระยะกลาง</h2><p>เข้าสู่ระบบบัญชีเจ้าของพอร์ตเพื่อดูข้อมูล Dime, Webull และ Folio</p></section><section id="personal-details" class="pastel-card pp"></section>';
  document.getElementById('page-portfolio').parentElement.append(p);
  p.addEventListener('change',e=>{if(e.target.id==='personal-role-filter'){personalFilter=e.target.value;filterRoles();}else if(e.target.dataset.position)filterRoles();});return p;
 }
 function filterRoles(){const table=document.querySelector('#personal-details table');if(!table)return;Array.from(table.tBodies).forEach(tb=>Array.from(tb.rows).forEach(row=>{const role=row.querySelector('select[data-position]')?.value;row.hidden=personalFilter!=='all'&&role!==personalFilter;}));}
 function syncPersonalNav(){const nav=document.getElementById('nav-personal');if(nav)nav.style.display=isMithongSession()?'':'none';}
 function route(id){switchPage(id,document.querySelector(id==='personal'?'#nav-personal':`[onclick="switchPage('${id}', this)"]`));}
 function stockSetup(){
  const page=document.getElementById('page-thaistock');if(!page||document.getElementById('stock-gpf'))return;
  const gpf=document.createElement('div');gpf.id='stock-gpf';gpf.className='space-y-6';while(page.firstChild)gpf.append(page.firstChild);
  const head=document.createElement('section');head.className='pastel-card pp';head.innerHTML='<h2>ข้อมูลหุ้นและหลักทรัพย์</h2><p>สำรวจหุ้นใน กบข. ตรวจหลักทรัพย์ที่ถือ หรือสร้างรายการเฝ้าติดตามของคุณ</p><div class="stock-tabs" role="tablist" aria-label="หมวดข้อมูลหุ้น"><button role="tab" data-stock-tab="gpf">หุ้น กบข.</button><button role="tab" data-stock-tab="owned">หุ้นที่ถือ</button><button role="tab" data-stock-tab="watch">หุ้นเฝ้าติดตาม</button></div>';
  const quote=document.createElement('section');quote.className='pastel-card pp';
  quote.innerHTML='<h3>ค้นหาราคาหุ้น</h3><p class="pp-note">หุ้นสหรัฐ เช่น AAPL, NVDA · หุ้นและ DR ไทยใส่ .BK เช่น PTT.BK · ราคาอาจล่าช้า</p><form id="shared-quote-form"><div class="pp-fields"><label>สัญลักษณ์หลักทรัพย์<input id="shared-quote-symbol" maxlength="24" required placeholder="AAPL"></label></div><button type="submit">ค้นหาราคา</button></form><p id="shared-quote-result" role="status"></p>';
  quote.addEventListener('submit',async e=>{
   e.preventDefault();const symbol=quote.querySelector('#shared-quote-symbol').value.trim().toUpperCase(),out=quote.querySelector('#shared-quote-result'),token=sessionToken,request=++quoteRequest;
   if(!/^[A-Z0-9.-]{1,24}$/.test(symbol)){out.textContent='กรอกชื่อย่อหุ้น เช่น AAPL หรือ PTT.BK';return;}
   if(!token){out.textContent='กรุณาเข้าสู่ระบบก่อนค้นหาราคา';return;}
   out.textContent='กำลังอ่านราคา…';
   try{const result=await callBackend('fetchMarketData',{symbols:[symbol]});if(token!==sessionToken||request!==quoteRequest)return;const q=result?.data?.[symbol],price=Number(q?.price);if(!(price>0))throw Error('ไม่พบราคา');
    const time=value=>{const t=Date.parse(value);return Number.isFinite(t)?new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(t))+' น. (เวลาไทย)':'ไม่ทราบ';};
    const source=q.source==='webull'?'Webull':q.source==='yahoo'?'Yahoo':'ไม่ทราบแหล่งราคา';out.textContent=symbol+' · '+price+' '+(symbol.endsWith('.BK')?'THB':'USD')+' · '+source+' · เวลาเรียก '+time(result.fetchedAt)+' · เวลาราคา '+time(q.quoteTime)+' · ราคาอาจล่าช้า';
   }catch(error){if(token===sessionToken&&request===quoteRequest)out.textContent='ยังไม่พบราคาสำหรับ '+symbol+' หรือไม่สามารถเชื่อมต่อได้';}
  });
  const owned=document.createElement('section');owned.id='stock-owned';owned.className='hidden pastel-card pp';
  const tracked=document.createElement('section');tracked.id='stock-watch';tracked.className='hidden pastel-card pp';
  page.append(head,quote,gpf,owned,tracked);
  head.addEventListener('click',e=>{if(e.target.dataset.stockTab)selectStocks(e.target.dataset.stockTab);});
  tracked.addEventListener('submit',e=>{if(e.target.id!=='watch-form')return;e.preventDefault();
   const symbol=document.getElementById('watch-symbol').value.trim().toUpperCase(),market=document.getElementById('watch-market').value,note=document.getElementById('watch-note').value.trim().slice(0,240);
   if(!/^[A-Z0-9.^-]{1,24}$/.test(symbol)){document.getElementById('watch-status').textContent='กรอกสัญลักษณ์หลักทรัพย์ไม่เกิน 24 ตัวอักษร';return;}
   if(watch.some(p=>p.symbol===symbol&&p.market===market)){document.getElementById('watch-status').textContent='มีหลักทรัพย์นี้ในรายการแล้ว';return;}
   if(watch.length>=100){document.getElementById('watch-status').textContent='รายการเฝ้าติดตามครบ 100 รายการแล้ว';return;}
   watch.push({symbol,market,note});storeWatch();renderStocks();
  });
  tracked.addEventListener('click',e=>{if(e.target.dataset.removeWatch!==undefined){watch.splice(Number(e.target.dataset.removeWatch),1);storeWatch();renderStocks();}});
  selectStocks(stockTab);
 }
 function selectStocks(tab){stockTab=tab;['gpf','owned','watch'].forEach(t=>{document.getElementById('stock-'+t)?.classList.toggle('hidden',t!==tab);const b=document.querySelector(`[data-stock-tab="${t}"]`);if(b){b.setAttribute('aria-selected',String(t===tab));b.classList.toggle('selected',t===tab);}});if(tab==='gpf'&&typeof switchMarketSubTab==='function')switchMarketSubTab('holdings');}
 function readWatch(){watch=[];if(!isMithongSession())return;try{const a=JSON.parse(localStorage.getItem('mygpf-watchlist-mithong')||'[]');if(Array.isArray(a))watch=a.filter(p=>typeof p.symbol==='string'&&['SET','US'].includes(p.market)).slice(0,100);}catch(e){}}
 function storeWatch(){try{localStorage.setItem('mygpf-watchlist-mithong',JSON.stringify(watch));}catch(e){document.getElementById('watch-status').textContent='เบราว์เซอร์ไม่อนุญาตบันทึก รายการยังอยู่เฉพาะหน้านี้';}}
 function renderStocks(){
  stockSetup();const owned=document.getElementById('stock-owned'),tracked=document.getElementById('stock-watch');if(!owned)return;
  if(!isMithongSession()){owned.innerHTML='<h3>หุ้นที่ถือ</h3><p>ยังไม่มีข้อมูลพอร์ตส่วนตัวสำหรับบัญชีนี้</p>';tracked.innerHTML='<h3>หุ้นเฝ้าติดตาม</h3><p>เข้าสู่ระบบบัญชีเจ้าของพอร์ตเพื่อจัดรายการเฝ้าติดตาม</p>';return;}
  if(privateMode()){owned.innerHTML='<h3>หุ้นที่ถือ</h3><p>ซ่อนรายการตามโหมดความเป็นส่วนตัว</p>';tracked.innerHTML='<h3>หุ้นเฝ้าติดตาม</h3><p>ซ่อนรายการตามโหมดความเป็นส่วนตัว</p>';return;}
  const a=(snapshot?.positions||[]).filter(p=>p.broker!=='กบข.'&&Number(p.quantity)>0);
  owned.innerHTML=`<h3>หลักทรัพย์ที่ถือจากฐานพอร์ต (${a.length} รายการ)</h3><p class="pp-note">Dime เป็น snapshot ย้อนหลัง; ราคาและเวลาแต่ละแหล่งต่างกัน ใช้ตรวจพอร์ต ไม่ใช่สัญญาณซื้อขายทันที</p><div class="pp-scroll"><table><thead><tr><th>หลักทรัพย์</th><th>บัญชี</th><th>จำนวน</th><th>ราคาอ้างอิง</th><th>มูลค่า</th><th>วันที่ข้อมูล</th></tr></thead><tbody>${a.map(p=>`<tr><td><b>${esc(p.symbol)}</b></td><td>${esc(p.broker)}</td><td>${(p.quantity==null?'—':GpfNumbers.fixed(p.quantity))}</td><td>${amount(p.price,p.currency)}</td><td>${amount(p.value,p.currency)}</td><td>${esc(p.date||'—')}</td></tr>`).join('')||'<tr><td colspan="6">รอเชื่อมข้อมูลพอร์ตส่วนตัว</td></tr>'}</tbody></table></div>`;
  tracked.innerHTML=`<h3>หุ้นเฝ้าติดตาม (${watch.length})</h3><p class="pp-note">รายการที่คุณสนใจ แยกจากสถานะถือครอง บันทึกในเบราว์เซอร์นี้ ไม่ซิงก์ข้ามเครื่อง และยังไม่เชื่อมราคาสดหรือจัดอันดับแนะนำซื้อ</p><form id="watch-form"><div class="pp-fields"><label>สัญลักษณ์หุ้น / DR<input id="watch-symbol" required maxlength="24" placeholder="เช่น CPALL หรือ NVDA80"></label><label>ตลาด<select id="watch-market"><option value="SET">SET / DR ไทย</option><option value="US">สหรัฐฯ</option></select></label><label>เหตุผลที่ติดตาม<input id="watch-note" maxlength="240" placeholder="เหตุการณ์ / เงื่อนไขที่ต้องการรอ"></label></div><button type="submit">เพิ่มหุ้นเฝ้าติดตาม</button></form><p id="watch-status" role="status"></p><div class="pp-scroll"><table><thead><tr><th>หลักทรัพย์</th><th>ตลาด</th><th>เหตุผลที่ติดตาม</th><th>จัดการ</th></tr></thead><tbody>${watch.map((p,i)=>`<tr><td>${esc(p.symbol)}</td><td>${esc(p.market)}</td><td>${esc(p.note)}</td><td><button data-remove-watch="${i}">นำออก</button></td></tr>`).join('')||'<tr><td colspan="4">ยังไม่มีหุ้นเฝ้าติดตาม เพิ่มได้จากแบบฟอร์มด้านบน</td></tr>'}</tbody></table></div>`;
 }
 function organize(model){
  snapshot=model;personalPage();const overview=document.getElementById('personal-portfolio'),body=document.getElementById('personal-details'),intro=document.getElementById('personal-intro');body.replaceChildren();
  if(model.masked){intro.innerHTML='<h2>พอร์ตส่วนตัว</h2><p>ซ่อนข้อมูลและแผนส่วนตัวตามโหมดความเป็นส่วนตัว</p>';renderStocks();return;}
  const accounts=(model.accounts||[]).filter(a=>a.name!=='กบข.'),positions=(model.positions||[]).filter(p=>p.broker!=='กบข.');
  intro.innerHTML=`<span class="pp-eyebrow">SHORT & MEDIUM TERM</span><h2>พอร์ตส่วนตัว · ระยะสั้นและระยะกลาง</h2><p>Dime · Webull · Folio รวม ${positions.length} รายการจากฐานข้อมูล แยกงบเทรดจากเงินเกษียณ กบข.</p><div class="pp-accounts">${accounts.map(a=>`<article><h3>${esc(a.name)}</h3><strong>${amount(a.value)}</strong><p>เงินสด ${amount(a.cash)}</p><small>${esc(a.date)}</small><p>${esc(a.note)}</p></article>`).join('')}</div>`;
  if(overview){
   overview.querySelectorAll(':scope > details,:scope > footer').forEach(d=>body.append(d));
   const old=overview.querySelector('.pp-personal-link');if(old)old.remove();const link=document.createElement('button');link.className='pp-personal-link';link.textContent='เจาะลึกพอร์ตระยะสั้น–กลาง →';link.onclick=()=>route('personal');overview.append(link);
   // Retirement remains on the overview; personal details contain trading positions only.
   const table=body.querySelector('table');if(table){Array.from(table.tBodies).forEach(tb=>Array.from(tb.rows).forEach(row=>{if(row.cells[0]?.innerText.includes('กบข.'))row.remove();}));const title=table.closest('details')?.querySelector('summary');if(title)title.textContent=`รายการถือครองและกลยุทธ์ส่วนตัว (${positions.length})`;const label=document.createElement('label');label.textContent='ดูกลยุทธ์ ';const filter=document.createElement('select');filter.id='personal-role-filter';filter.innerHTML=[['all','ทั้งหมด'],['medium','ระยะกลาง'],['swing','เก็งกำไรระยะสั้น'],['unassigned','ยังไม่จัดกลยุทธ์']].map(([v,t])=>`<option value="${v}">${t}</option>`).join('');filter.value=personalFilter;label.append(filter);table.parentElement.before(label);filterRoles();}
  }
  const webull=document.getElementById('personalWebullSection');if(webull)document.getElementById('page-personal').append(webull);
  readWatch();renderStocks();
  if(!document.getElementById('page-portfolio').classList.contains('hidden'))document.getElementById('main_title').textContent='📈 ภาพรวมทุกพอร์ต';
 }
 personalPage();stockSetup();syncPersonalNav();
 const oldLogin=window.login;window.login=async function(){try{return await oldLogin.apply(this,arguments);}finally{syncPersonalNav();}};
 const oldSwitch=window.switchPage;window.switchPage=function(id,el){if(id==='personal'&&!isMithongSession())return;personalPage();const result=oldSwitch.apply(this,arguments);const titles={portfolio:'📈 ภาพรวมทุกพอร์ต',personal:'💼 พอร์ตส่วนตัว · ระยะสั้น–กลาง',thaistock:'📊 ข้อมูลหุ้นและหลักทรัพย์'};if(titles[id])document.getElementById('main_title').textContent=titles[id];if(id==='thaistock')selectStocks(stockTab);if(id==='personal'||id==='thaistock')renderStocks();window.scrollTo({top:0,behavior:'auto'});return result;};
 document.addEventListener('personalportfolio:render',e=>organize(e.detail));
 const oldLogout=window.logout;window.logout=function(){snapshot=null;watch=[];quoteRequest++;const q=document.getElementById('shared-quote-result');if(q)q.textContent='';const input=document.getElementById('shared-quote-symbol');if(input)input.value='';document.getElementById('personal-details')?.replaceChildren();document.getElementById('personal-intro').innerHTML='<h2>พอร์ตส่วนตัว</h2><p>เข้าสู่ระบบเพื่อดูพอร์ตของคุณ</p>';const ret=oldLogout.apply(this,arguments);syncPersonalNav();renderStocks();return ret;};
})();
