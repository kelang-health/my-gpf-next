/* Presentation helpers only: no account or investment data mutations. */
(()=>{'use strict';let pending=false;
 function improve(){pending=false;
  document.querySelectorAll('#personal-details table,#stock-owned table,#trading-challenge table').forEach(table=>{const headers=Array.from(table.querySelectorAll('thead th')).map(h=>h.textContent.trim());if(!headers.length)return;table.dataset.mobileCards='true';table.querySelectorAll('tbody tr').forEach(row=>Array.from(row.cells).forEach((cell,i)=>{cell.dataset.label=headers[i]||'';}));});
  document.querySelectorAll('.table-responsive').forEach(box=>{if(box.querySelector('table')&&!box.previousElementSibling?.classList.contains('scroll-hint')){const hint=document.createElement('p');hint.className='scroll-hint';hint.textContent='↔ เลื่อนตารางซ้าย–ขวาเพื่อดูข้อมูลครบ';box.before(hint);}});
  const nav=document.querySelector('#main-app>nav');if(nav){nav.setAttribute('aria-label','เมนูหลัก');nav.querySelectorAll('.nav-item').forEach(b=>{const active=b.classList.contains('nav-tab-active');if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(improve);}}
 function init(){const main=document.querySelector('#main-app>main');if(main){main.id='main-content';const skip=document.createElement('a');skip.className='vivid-skip';skip.href='#main-content';skip.textContent='ข้ามไปยังเนื้อหา';document.body.prepend(skip);main.tabIndex=-1;}
  document.querySelector('button[onclick="togglePrivacy()"]')?.setAttribute('aria-label','ซ่อนหรือแสดงข้อมูลพอร์ต');document.querySelector('button[onclick="logout()"]')?.setAttribute('aria-label','ออกจากระบบ');
  improve();const observer=new MutationObserver(schedule);const app=document.getElementById('main-app');if(app)observer.observe(app,{childList:true,subtree:true});document.addEventListener('personalportfolio:render',schedule);document.querySelector('#main-app>nav')?.addEventListener('click',schedule);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
