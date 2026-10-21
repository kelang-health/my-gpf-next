(()=>{'use strict';let busy=false,run=0;
 const names={gemini:'Google Gemini',groq:'Groq',openrouter:'OpenRouter',github:'GitHub Models (ยุติบริการ)',deepseek:'DeepSeek',openai:'OpenAI'};
 function init(){const selector=document.getElementById('aiEngineSelect'),card=selector?.closest('.pastel-card');if(!card)return;
  card.id='private-ai-analysis';document.getElementById('page-analysis')?.prepend(card);
  card.querySelector('h3 span:last-child').textContent='AI วิเคราะห์พอร์ต กบข.';
  const intro=card.querySelector('p');intro.textContent='วิเคราะห์ข้อมูล กบข. ในบัญชี ไม่ใช่การค้นข่าวหรือราคาหุ้นสด รายงานหุ้นไทย/สหรัฐอยู่ในส่วน Equity Research ด้านล่าง';
  for(const option of selector.options){option.textContent=names[option.value]||option.value;if(option.value==='github')option.disabled=true;}
  if(selector.value==='github')selector.value='gemini';selector.setAttribute('aria-label','ผู้ให้บริการ AI');
  const controls=selector.parentElement;controls.classList.add('flex-wrap');selector.style.maxWidth='100%';
  const local=document.createElement('button');local.type='button';local.className='rounded-xl border px-4 py-2 text-xs text-slate-700';local.textContent='วิเคราะห์ในเครื่อง';local.onclick=()=>{if(typeof isMasked!=='undefined'&&isMasked)return;generateLocalFallbackAnalysis();document.getElementById('ai-provider-status').textContent='วิเคราะห์ด้วยสูตรในเครื่อง — ไม่ใช่คำตอบจาก AI ภายนอก';};controls.append(local);
  const status=document.createElement('p');status.id='ai-provider-status';status.setAttribute('role','status');status.className='text-xs text-slate-600';status.textContent='เลือกผู้ให้บริการแล้วกดวิเคราะห์ ระบบจะขอยืนยันข้อมูลที่จะส่ง';intro.after(status);
  callBackend('getPublicConfig').then(cfg=>{if(cfg.primaryAi&&selector.querySelector(`option[value="${cfg.primaryAi}"]:not(:disabled)`))selector.value=cfg.primaryAi;for(const result of cfg.aiTest?.providers||[]){const option=Array.from(selector.options).find(o=>o.value===result.provider);if(option)option.textContent=(names[result.provider]||result.provider)+' · '+(result.success?'ทดสอบผ่าน':result.code==='HTTP_429'||result.code==='HTTP_402'?'โควตา/เครดิตไม่พร้อม':'ยังไม่พร้อม');}if(cfg.aiTest)status.textContent='ทดสอบการเชื่อมต่อ '+new Date(cfg.aiTest.testedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' · สถานะอาจเปลี่ยนตามโควตา';}).catch(()=>{});
  const originalLogout=window.logout;window.logout=function(){run++;busy=false;document.getElementById('aiEvaluatorResult').textContent='เข้าสู่ระบบเพื่อวิเคราะห์พอร์ต';status.textContent='';return originalLogout.apply(this,arguments);};
  const originalPrivacy=window.togglePrivacy;if(originalPrivacy)window.togglePrivacy=function(){const ret=originalPrivacy.apply(this,arguments);document.getElementById('aiEvaluatorResult').classList.toggle('hidden',isMasked);return ret;};
 }
 window.triggerQuantumAiEvaluator=async function(){if(busy)return;const output=document.getElementById('aiEvaluatorResult'),selector=document.getElementById('aiEngineSelect'),status=document.getElementById('ai-provider-status'),engine=selector.value;
  if(!currentUser){output.textContent='กรุณาเข้าสู่ระบบก่อน';return;}
  if(typeof isMasked!=='undefined'&&isMasked){status.textContent='ปิดโหมดซ่อนข้อมูลก่อนใช้งาน AI';return;}
  const choice=await Swal.fire({title:'ส่งข้อมูลให้ '+names[engine]+'?',text:'ส่งเฉพาะทุนยกมา เงินนำส่ง ชื่อแผน และจำนวนหน่วย กบข. ไม่ส่งชื่อผู้ใช้ Dime Webull หรือ Challenge ผู้ให้บริการอาจประมวลผลตามนโยบายของตน และระบบจะไม่สลับไปเจ้าอื่นอัตโนมัติ',icon:'info',showCancelButton:true,confirmButtonText:'ยืนยันส่งและวิเคราะห์',cancelButtonText:'ยกเลิก'});
  if(!choice.isConfirmed)return;
  const ticket=++run;busy=true;selector.disabled=true;const button=document.querySelector('button[onclick="triggerQuantumAiEvaluator()"]');if(button)button.disabled=true;output.textContent='กำลังรอคำตอบจาก '+names[engine]+'…';status.textContent='ส่งข้อมูลไปยัง '+names[engine]+' ตามที่ยืนยันแล้ว';
  try{const result=await callBackend('generateQuantumAIAnalysis',{requestedEngine:engine,aiConsent:true});if(ticket!==run||!currentUser)return;
   if(!result.success||!result.externalAi||!result.analysis)throw Error(result.message||'AI ไม่คืนคำตอบ กรุณาเลือกผู้ให้บริการอื่น');
   output.innerHTML=GpfSecurity.markdown(result.analysis);cachedAiAnalysis=output.innerHTML;status.textContent='AI จริง: '+result.engineName+' · '+new Date(result.generatedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})+' · ต้องตรวจตัวเลขและแหล่งข้อมูลก่อนใช้';
  }catch(error){if(ticket===run&&currentUser){output.textContent=error.message||'เรียก AI ไม่สำเร็จ';status.textContent='ยังไม่ได้คำตอบจาก AI — เลือกผู้ให้บริการอื่นหรือกดวิเคราะห์ในเครื่อง';}}
  finally{if(ticket===run){busy=false;selector.disabled=false;if(button)button.disabled=false;}}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
