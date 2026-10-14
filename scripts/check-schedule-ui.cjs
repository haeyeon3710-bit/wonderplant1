// Exercises the real editor handlers in an isolated DOM, without live traffic.
const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict'),M=require('../admin/model.js');
const dom=new JSDOM(fs.readFileSync('editor.html','utf8'),{url:'https://cms-test.invalid/adm/new',runScripts:'outside-only'}),w=dom.window,d=w.document;
const tick=()=>new Promise(resolve=>setImmediate(resolve));let saved,posts=[];
w.WonderfulAdmin=M;w.crypto.randomUUID=()=> '11111111-1111-4111-8111-111111111111';w.HTMLElement.prototype.scrollIntoView=function(){};
w.WonderfulAuth={session:async()=>({user:{id:'fixture-admin'}}),request:async(url,body)=>{
 if(!body)return {posts,categories:M.categories.map((c,i)=>({...c,is_active:true,sort_order:i}))};
 saved=body.post;return {post:{...saved,version:1,updatedAt:new Date().toISOString()}};
}};
w.eval(fs.readFileSync('admin/database.js','utf8'));w.eval(fs.readFileSync('admin/app.js','utf8'));
(async()=>{
 assert.equal(M.scheduleIso('2026-10-15T16:30'),'2026-10-15T07:30:00.000Z');
 assert.equal(M.scheduleInput('2026-10-15T07:30:00.000Z'),'2026-10-15T16:30');
 assert.equal(M.scheduleIso('2026-02-31T12:30'),null);assert.equal(M.scheduleIso('bad'),null);
 await tick();await tick();assert.equal(d.querySelector('#app').hidden,false);
 assert.equal(d.querySelector('#summary').required,false);assert.equal(d.querySelector('#summary').maxLength,130);
 d.querySelector('#summary').value='짧은 설명';d.querySelector('#summary').dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(d.querySelector('#summary-count').className,'counter valid');
 d.querySelector('#schedule-post').click();assert.equal(d.querySelector('#schedule-field').hidden,false);assert.equal(saved,undefined);
 const status=d.querySelector('#post-status');assert.equal(status.value,'scheduled');
 const local=M.scheduleInput(new Date(Date.now()+3600000).toISOString());d.querySelector('#scheduled-at').value=local;
 d.querySelector('#title').value='예약 글';d.querySelector('#slug').value='예약-글';d.querySelector('#category').value='implant';d.querySelector('#thumbnail').value='/images/lifespan.png';d.querySelector('#thumbnail-alt').value='대체 텍스트';
 d.querySelector('#blocks textarea').value='본문';d.querySelector('#blocks textarea').dispatchEvent(new w.Event('input',{bubbles:true}));
 d.querySelector('#schedule-post').click();await tick();await tick();assert.equal(saved.status,'scheduled');assert.equal(saved.scheduledAt,M.scheduleIso(local));assert(d.querySelector('#message').textContent.includes('예약되었습니다'));
 status.value='draft';status.dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('#schedule-field').hidden,true);
 d.querySelector('#editor-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await tick();await tick();assert.equal(saved.scheduledAt,null);assert.equal(saved.status,'draft');
 console.log('PASS: Korean time conversion, invalid dates, optional short summaries, schedule/save/cancel handlers and recovery-safe editor.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>w.close());
