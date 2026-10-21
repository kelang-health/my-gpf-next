/* Untrusted markdown must never create scripts, forms, remote images or event handlers. */
window.GpfSecurity={
 escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 markdown(value){const source=String(value??'');if(!window.DOMPurify||!window.marked)return this.escape(source).replace(/\n/g,'<br>');return DOMPurify.sanitize(marked.parse(source),{USE_PROFILES:{html:true},SANITIZE_NAMED_PROPS:true,FORBID_TAGS:['style','script','iframe','form','input','button','select','textarea','img','video','audio','source','object','embed','link','meta','base']});}
};
