// An isolated DOM test, not a controller for the user's browser.
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const M=require('../admin/model.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const fixture={id:'11111111-1111-4111-8111-111111111111',title:'삭제 검사 초안',slug:'fixture-draft',category:'implant',summary:'가'.repeat(120),thumbnail:'/images/lifespan.png',thumbnailAlt:'이미지',blocks:[{type:'text',text:'검사 본문'}],status:'draft',version:1,viewCount:0,updatedAt:new Date().toISOString()};
const legacy={...fixture,id:'2',title:'이전 브라우저 초안',slug:'legacy-draft',category:undefined};
const raw=JSON.stringify([legacy]);
const dom=new JSDOM(fs.readFileSync('adm.html','utf8'),{url:'https://cms-test.invalid/adm',runScripts:'outside-only'});
const w=dom.window;let rows=[clone(fixture)];const calls=[],downloads=[];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
w.WonderfulAdmin=M;w.crypto.randomUUID=crypto.randomUUID;
w.HTMLElement.prototype.scrollIntoView=function(){};
// jsdom lacks dialog APIs. Supply only the platform boundary; the real app
// controls opening, question text, cancellation, and the async close handler.
w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
w.HTMLDialogElement.prototype.close=function(value){if(value!==undefined)this.returnValue=value;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
w.URL.createObjectURL=blob=>{downloads.push(blob);return 'https://cms-test.invalid/download/'+downloads.length;};
w.URL.revokeObjectURL=()=>{};
w.document.addEventListener('click',event=>{if(event.target.tagName==='A'&&event.target.download)event.preventDefault();},true);
w.localStorage.setItem(M.STORE_KEY,raw);
w.WonderfulAuth={session:async()=>({user:{id:'fixture-admin',username:'fixture_admin'}}),request:async(url,body)=>{
 if(!body)return {posts:clone(rows),categories:M.categories.map((c,i)=>({...c,slug:c.id,sort_order:i,is_active:true}))};
 calls.push(clone(body));
 if(body.action==='delete'){rows=rows.filter(p=>p.id!==body.id);return {success:true};}
 if(body.action==='save'){const p={...body.post,version:1,viewCount:0,updatedAt:new Date().toISOString(),legacyHtml:''};rows.unshift(p);return {post:clone(p)};}
 throw new Error('Unexpected request');
}};
w.eval(fs.readFileSync('admin/database.js','utf8'));
w.eval(fs.readFileSync('admin/app.js','utf8'));
const readBlob=blob=>new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(blob);});
(async()=>{
 await tick();await tick();assert.equal(w.document.getElementById('app').hidden,false);
 const statusFilter=w.document.getElementById('status-filter');statusFilter.value='published';statusFilter.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('#post-list tr').length,0);
 statusFilter.value='draft';statusFilter.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('#post-list tr').length,1);
 statusFilter.value='all';statusFilter.dispatchEvent(new w.Event('change'));
 const remove=w.document.querySelector('button[aria-label="삭제 검사 초안 삭제"]');
 const dialog=w.document.getElementById('confirm-dialog');
 remove.click();assert(dialog.open);assert(w.document.getElementById('confirm-question').textContent.includes(fixture.title));
 dialog.close('cancel');await tick();assert.equal(calls.length,0,'Cancel must not delete or export');
 remove.click();dialog.close('confirm');await tick();await tick();
 assert.equal(calls[0].action,'delete');assert.equal(calls[0].version,1);assert.equal(w.document.querySelectorAll('#post-list tr').length,0);
 assert.equal(JSON.parse(await readBlob(downloads[0])).title,fixture.title,'Delete must back up content first');
 assert.equal(w.localStorage.getItem(M.STORE_KEY),raw,'Old drafts must remain byte-for-byte unchanged');
 w.document.getElementById('import-local').click();assert(dialog.open);dialog.close('confirm');await tick();await tick();
 const imported=calls.find(c=>c.action==='save').post;
 assert.equal(imported.status,'draft');assert.equal(imported.category,'complex-implant');assert.notEqual(imported.id,'2');assert(imported.slug.includes('가져오기'));
 assert.equal(w.localStorage.getItem(M.STORE_KEY),raw);
 const input=w.document.getElementById('import-json');
 Object.defineProperty(input,'files',{configurable:true,value:[{size:500,text:async()=>JSON.stringify({...fixture,id:'old-json',category:'orthodontics'})}]});
 input.dispatchEvent(new w.Event('change'));await tick();await tick();
 const jsonPost=calls.filter(c=>c.action==='save')[1].post;assert.equal(jsonPost.category,'orthodontics');assert.equal(jsonPost.status,'draft');assert.notEqual(jsonPost.id,'old-json');
 console.log('PASS: real admin handlers open/cancel/confirm dialogs, export before delete, preserve old drafts, and import local/JSON data as distinct categorized drafts (isolated DOM).');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
