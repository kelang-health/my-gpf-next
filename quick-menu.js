/* Per-user shortcuts: use existing authenticated views, never pass user IDs in links. */
(() => {
  'use strict';
  const routes = Object.freeze({
    balance:{label:'ยอดพอร์ต',page:'portfolio',note:'ยอดแต่ละบัญชีอาจเป็นข้อมูลต่างวัน ตรวจวันที่และความครบถ้วนก่อนรวมยอด'},
    movement:{label:'ความเคลื่อนไหว',page:'daily',note:'การเปลี่ยนแปลงตาม NAV ล่าสุดเทียบจุดก่อนหน้า ไม่ใช่ผลตอบแทนวันนี้เสมอ และไม่ใช่ประวัติซื้อขายจริง'},
    allocation:{label:'สัดส่วนลงทุน',page:'portfolio',note:'ส่วนนี้แสดงสัดส่วนแผน กบข. ไม่ใช่สัดส่วนสินทรัพย์รวมทุกโบรกเกอร์'},
    risk:{label:'ความเสี่ยง',page:'portfolio',note:'ตัวชี้วัดนี้ใช้พอร์ตจำลองด้วยหน่วยปัจจุบันคงที่ × NAV ย้อนหลัง อ่านวิธีคำนวณและข้อจำกัดประกอบ'},
    plan:{label:'ทบทวนแผน',page:'portfolio',note:'ใช้ทบทวนเป้าหมายและข้อมูลที่มี ไม่ส่งคำสั่งซื้อขายและไม่สร้างราคาเป้าหมายอัตโนมัติ'},
    full:{label:'พอร์ตเต็ม',page:'portfolio',note:''}
  });
  const valid = value => Object.hasOwn(routes, value) ? value : null;
  function fromUrl(search) {
    const query = new URLSearchParams(search);
    const direct = valid(query.get('view')); if (direct) return direct;
    const state = query.get('liff.state');
    if (state) {
      try {const nested = new URL(state, location.origin);return valid(nested.searchParams.get('view'));} catch (_) {return null;}
    }
    return null;
  }
  let pending = fromUrl(location.search), ready = false, scheduled = false;
  function heading(text) {
    return Array.from(document.querySelectorAll('#page-portfolio h3')).find(el=>el.textContent.includes(text));
  }
  function reviewPanel() {
    let box = document.getElementById('gpf-plan-review'); if (box) return box;
    box = document.createElement('section'); box.id = 'gpf-plan-review'; box.className = 'pastel-card gpf-quick-review'; box.hidden = true;
    const title = document.createElement('h2'); title.textContent = 'ทบทวนแผนลงทุน'; box.append(title);
    const list = document.createElement('ul');
    ['ตรวจวันที่ยอดพอร์ต NAV ราคา และเงินสดก่อนตัดสินใจ','เทียบสัดส่วนปัจจุบันกับเป้าหมายที่คุณกำหนด และตรวจสินทรัพย์ที่ถือซ้ำ','ทบทวนเหตุผลลงทุน กรอบเวลา และเงื่อนไขที่ทำให้ต้องเปลี่ยนแผน','ตรวจงบเสี่ยงและค่าธรรมเนียมก่อนปรับพอร์ต; ข้อมูลขาดให้ตรวจเพิ่มก่อน'].forEach(text=>{const item=document.createElement('li');item.textContent=text;list.append(item);});
    box.append(list);
    const link = document.createElement('button'); link.type='button'; link.textContent='ดูสัดส่วนปัจจุบัน'; link.addEventListener('click',()=>navigate('allocation')); box.append(link);
    document.getElementById('page-portfolio').prepend(box); return box;
  }
  function navigate(value) {
    const id=valid(value); if (!id) return false;
    pending=id;
    if (!ready || !currentUser || !sessionToken) return false;
    const route=routes[id];
    const nav=Array.from(document.querySelectorAll('#main-app [onclick]')).find(el=>el.getAttribute('onclick').includes("switchPage('"+route.page+"'"));
    switchPage(route.page,nav);
    const note=document.getElementById('gpf-quick-note'); note.textContent=route.note;
    const panel=reviewPanel(); panel.hidden=id!=='plan';
    let target;
    if(id==='balance') target=document.getElementById('personal-portfolio') || document.getElementById('kpi_total_money');
    if(id==='movement') target=document.getElementById('page-daily');
    if(id==='allocation') target=heading('สัดส่วนการลงทุน') || document.getElementById('holdingsTableBody');
    if(id==='risk') target=document.getElementById('investment-insights');
    if(id==='plan') target=panel;
    if(id==='full') target=document.getElementById('page-portfolio');
    if (!target) {note.textContent=route.note+' · ยังไม่มีข้อมูลส่วนนี้ในบัญชีของคุณ';pending=null;return false;}
    if(id==='plan') {
      const saved=document.getElementById('pp-save');
      if(saved && !panel.querySelector('[data-saved-plan]')) {
        const open=document.createElement('button');open.type='button';open.dataset.savedPlan='true';open.textContent='เปิดแผนและกรอบเสี่ยงที่บันทึกไว้';
        open.addEventListener('click',()=>{switchPage('personal',document.getElementById('nav-personal'));const target=document.getElementById('pp-save')?.closest('details');if(target){target.open=true;target.scrollIntoView({behavior:'auto',block:'start'});}});panel.append(open);
      }
    }
    pending=null;
    requestAnimationFrame(()=>target.scrollIntoView({behavior:'auto',block:'start'}));
    const url=new URL(location.href); url.searchParams.set('view',id);
    // The SDK must finish its OAuth callback before we update navigation parameters.
    if(!url.searchParams.has('code')&&!url.searchParams.has('liff.state')) history.replaceState(null,'',url);
    document.querySelectorAll('[data-gpf-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gpfView===id)));
    return true;
  }
  function schedule() {
    if(scheduled || !pending || !ready || !currentUser || !sessionToken)return;
    scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(pending)navigate(pending);});
  }
  const original=window.processData;
  window.processData=function(response) {
    const result=original.apply(this,arguments);
    ready=!!(response?.headers && response?.data && currentUser && sessionToken);
    schedule();return result;
  };
  const oldLogout=window.logout;
  window.logout=function(){ready=false;pending=null;document.getElementById('gpf-plan-review')?.remove();return oldLogout.apply(this,arguments);};
  function mount() {
    const host=document.getElementById('main-app');if(!host)return;
    const style=document.createElement('style');style.textContent='.gpf-quick-menu{margin:4px 12px;font-size:12px}.gpf-quick-menu summary{cursor:pointer;color:#334155;padding:7px}.gpf-quick-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:6px}.gpf-quick-grid button{font:inherit!important;padding:9px 5px!important;min-height:36px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#263a70}.gpf-quick-grid button[aria-pressed=true]{background:#e8f6ef;border-color:#059669}#gpf-quick-note{font-size:12px;margin:0 16px;color:#526476}#gpf-quick-note:empty{display:none}.gpf-quick-review{padding:24px;margin:16px 0}.gpf-quick-review h2{font-size:20px}.gpf-quick-review li{margin:10px 0}#gpf-plan-review[hidden]{display:none!important}#investment-insights,#gpf-plan-review,#personal-portfolio,#holdingsTableBody{scroll-margin-top:90px}';document.head.append(style);
    const details=document.createElement('details');details.className='gpf-quick-menu';
    const summary=document.createElement('summary');summary.textContent='เลือกข้อมูลพอร์ต';details.append(summary);
    const grid=document.createElement('div');grid.className='gpf-quick-grid';
    Object.entries(routes).forEach(([id,route])=>{const b=document.createElement('button');b.type='button';b.textContent=route.label;b.dataset.gpfView=id;b.addEventListener('click',()=>{navigate(id);details.open=false;});grid.append(b);});details.append(grid);
    const note=document.createElement('p');note.id='gpf-quick-note';note.setAttribute('role','status');host.prepend(details,note);
    window.GpfQuickMenu=Object.freeze({navigate,fromUrl,views:Object.keys(routes)});
  }
  window.GpfQuickMenu=Object.freeze({navigate,fromUrl,views:Object.keys(routes)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
