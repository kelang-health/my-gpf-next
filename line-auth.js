/* LINE tokens and myGPF sessions stay in memory; never in URLs or storage. */
(() => {
  'use strict';
  let config, sdkPromise, busy = false, generation = 0;
  const byId = id => document.getElementById(id);
  const message = text => {
    byId('gpf-line-message').textContent = text;
    if (byId('gpf-line-account-message')) byId('gpf-line-account-message').textContent = text;
  };
  const base = new URL('./', location.href);
  base.search = '?line=1'; base.hash = '';
  function button(text, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    b.className = 'gpf-line-button'; b.addEventListener('click', action); return b;
  }
  async function sdk() {
    if (!config?.enabled) throw new Error('ระบบผูก LINE ยังไม่เปิดใช้งาน');
    if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.onload = resolve; script.onerror = () => reject(new Error('โหลด LINE ไม่สำเร็จ'));
      document.head.append(script);
    }).then(() => window.liff.init({liffId:config.liffId}));
    await sdkPromise;
    if (!window.liff.isLoggedIn()) {
      window.liff.login({redirectUri:base.href}); return null;
    }
    const token = window.liff.getIDToken();
    if (!token) throw new Error('LINE ยังไม่อนุญาตการยืนยันตัวตน กรุณาเปิดผ่านริชเมนูอีกครั้ง');
    return token;
  }
  async function guarded(action) {
    if (busy) return; busy = true;
    document.querySelectorAll('.gpf-line-button').forEach(b => b.disabled = true);
    try { await action(); } catch (e) { message(e.message || 'เชื่อมต่อ LINE ไม่สำเร็จ'); }
    finally {busy = false; document.querySelectorAll('.gpf-line-button').forEach(b => b.disabled = false);}
  }
  async function enter() {
    const before = sessionToken, version = generation;
    message('กำลังยืนยันตัวตนกับ LINE…');
    const idToken = await sdk(); if (!idToken) return;
    const result = await callBackend('lineLogin', {idToken});
    if (before !== sessionToken || version !== generation) return;
    if (result.code === 'LINE_NOT_LINKED') {
      message('ครั้งแรก: เข้าสู่ระบบ myGPF เดิมก่อน แล้วกด “ผูกบัญชี LINE”'); return;
    }
    if (!result.success || !result.token || !result.username) throw new Error(result.message || 'เข้าสู่ระบบไม่สำเร็จ');
    cachedAiAnalysis = ''; sessionToken = result.token; currentUser = result.username;
    customPlanName = '🚀 พอร์ตของ ' + (result.fname || currentUser);
    byId('password').value = ''; byId('login-msg').textContent = '';
    byId('login-page').classList.add('hidden'); byId('main-app').classList.remove('hidden');
    byId('btnAdminPanel')?.classList.toggle('hidden', result.user?.role !== 'admin');
    message('');
    await fetchData();
    if (sessionToken && currentUser && typeof initGpfHoldingsDashboard === 'function') initGpfHoldingsDashboard();
  }
  function passwordDialog(title) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog'), form = document.createElement('form');
      const h = document.createElement('h3'); h.textContent = title;
      const detail = document.createElement('p'); detail.textContent = 'บัญชี myGPF: ' + currentUser;
      const label = document.createElement('label'); label.textContent = 'ยืนยันรหัสผ่าน myGPF';
      const input = document.createElement('input'); input.type = 'password'; input.required = true; input.autocomplete = 'current-password';
      const cancel = button('ยกเลิก', () => dialog.close());
      const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'ยืนยัน'; submit.className = 'gpf-line-button';
      label.append(input); form.append(h, detail, label, cancel, submit); dialog.append(form); document.body.append(dialog);
      let value = null;
      form.addEventListener('submit', event => {event.preventDefault(); value = input.value; input.value = ''; dialog.close();});
      dialog.addEventListener('close', () => {input.value = ''; dialog.remove(); resolve(value);}, {once:true});
      dialog.showModal(); input.focus();
    });
  }
  async function link() {
    const expected = sessionToken;
    if (!expected) throw new Error('กรุณาเข้าสู่ระบบ myGPF ก่อน');
    const idToken = await sdk(); if (!idToken) return;
    const proof = await callBackend('lineLinkChallenge', {idToken});
    if (!proof.success) throw new Error(proof.message || 'เตรียมผูกบัญชีไม่สำเร็จ');
    let password = await passwordDialog('ผูก LINE ที่กำลังใช้งานกับบัญชีนี้');
    if (password === null) return;
    if (expected !== sessionToken) {password = ''; return;}
    let result;
    try {result = await callBackend('lineLink', {idToken, challenge:proof.challenge, confirm:true, password});}
    finally {password = '';}
    if (!result.success) throw new Error(result.message || 'ผูกบัญชีไม่สำเร็จ');
    message(''); await refresh();
  }
  async function unlink() {
    const expected = sessionToken;
    let password = await passwordDialog('ยกเลิกการผูก LINE ของบัญชีนี้');
    if (password === null) return;
    if (expected !== sessionToken) {password = ''; return;}
    let result;
    try {result = await callBackend('lineUnlink', {password});} finally {password = '';}
    if (!result.success) throw new Error(result.message || 'ยกเลิกการผูกไม่สำเร็จ');
    // Existing LINE-derived sessions are invalidated by the server mapping version.
    sessionStorage.setItem('gpf-line-skip-once', '1'); logout();
  }
  async function refresh() {
    const expected = sessionToken, container = byId('gpf-line-account'); container.replaceChildren();
    if (!expected || !config?.enabled) return;
    const status = await callBackend('lineLinkStatus');
    if (expected !== sessionToken) return;
    if (!status.success) {message(status.message || 'ตรวจสถานะการผูกไม่สำเร็จ'); return;}
    container.dataset.linked = String(status.linked);
    if (status.linked) byId('gpf-line-account-message').textContent = '';
    const text = document.createElement('span'); text.textContent = status.linked ? 'ผูก LINE แล้ว' : 'ยังไม่ได้ผูก LINE';
    container.append(text, button(status.linked ? 'ยกเลิกการผูก LINE' : 'ผูกบัญชี LINE', () => guarded(status.linked ? unlink : link)));
  }
  async function init() {
    const style = document.createElement('style');
    style.textContent = '.gpf-line-button{background:#07883e;color:white;border:0;border-radius:12px;padding:12px 18px;margin:8px;font:inherit;cursor:pointer}.gpf-line-button:disabled{opacity:.5;cursor:wait}#gpf-line-message{font-size:14px;padding:8px;text-align:center}#gpf-line-account{display:flex;align-items:center;flex-wrap:wrap;justify-content:center}dialog{border:1px solid #ddd;border-radius:16px;padding:24px;max-width:90vw}dialog::backdrop{background:#0008}dialog label,dialog input{display:block}dialog input{border:1px solid #999;padding:10px;margin:10px 0}';
    style.textContent += "#main-app #gpf-line-account{gap:6px;padding:4px 12px;font-size:12px;line-height:1.4;min-height:36px}#main-app #gpf-line-account:empty,#gpf-line-account-message:empty,#gpf-line-message:empty{display:none}#main-app #gpf-line-account[data-linked=\"true\"]{color:#477064}#main-app #gpf-line-account[data-linked=\"true\"] .gpf-line-button{font-size:11px!important;font-weight:400!important;line-height:1.3!important;padding:4px 8px!important;margin:0!important;min-height:30px!important;min-width:0!important;width:auto!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:transparent!important;color:#64748b!important;box-shadow:none!important}#gpf-line-account-message{font-size:12px;padding:4px 12px;margin:0;color:#9a3412}";
    document.head.append(style);
    const loginBox = document.createElement('div'); loginBox.id = 'gpf-line-login';
    const msg = document.createElement('p'); msg.id = 'gpf-line-message'; msg.setAttribute('role','status');
    byId('login-msg').after(loginBox, msg);
    const account = document.createElement('div'); account.id = 'gpf-line-account'; byId('main-app').prepend(account);
    const accountMessage = document.createElement('p'); accountMessage.id = 'gpf-line-account-message'; accountMessage.setAttribute('role','status'); accountMessage.style.textAlign = 'center'; account.after(accountMessage);
    // Public configuration contains identifiers only. Disabled installations keep password login unchanged.
    try {config = await callBackend('getLineAuthConfig');} catch (_) {return;}
    if (!config?.enabled) return;
    loginBox.append(button('เข้าสู่ระบบด้วย LINE', () => guarded(enter)));
    const observer = new MutationObserver(() => {generation++; refresh().catch(() => message('ตรวจการผูก LINE ไม่สำเร็จ'));});
    observer.observe(byId('main-app'), {attributes:true, attributeFilter:['class']});
    const originalLogout = window.logout;
    window.logout = function() {generation++; sessionStorage.setItem('gpf-line-skip-once','1'); return originalLogout();};
    const skip = sessionStorage.getItem('gpf-line-skip-once'); sessionStorage.removeItem('gpf-line-skip-once');
    if (!skip && new URLSearchParams(location.search).get('line') === '1') await guarded(enter);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
