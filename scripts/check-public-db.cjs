const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {client,configuration}=require('../lib/supabase.cjs');
for(const line of fs.readFileSync(path.resolve(__dirname,'../.env'),'utf8').split(/\r?\n/)){
 const match=/^([A-Z_]+)=(.*)$/.exec(line);if(match&&process.env[match[1]]===undefined)process.env[match[1]]=match[2];
}
(async()=>{
 const [slug,expected,imagePath]=process.argv.slice(2);assert(['hidden','published'].includes(expected));const config=configuration();const api=client(config);
 const query=new URLSearchParams({environment:'eq.'+config.environment,slug:'eq.'+slug,select:'slug,status,category_id,published_at,view_count'});
 const rows=(await api.request('/rest/v1/posts?'+query)).data;
 assert.equal(rows.length,expected==='hidden'?0:1);
 if(rows.length){assert.equal(rows[0].status,'published');assert(rows[0].published_at);}
 if(imagePath){
  try{await api.request('/storage/v1/object/sign/cms-images/'+imagePath,{method:'POST',body:{expiresIn:60}});assert.equal(expected,'published','Unpublished image must not be readable');}
  catch(error){if(error instanceof assert.AssertionError)throw error;assert.equal(expected,'hidden');assert([400,401,403,404].includes(error.status));}
 }
 console.log('PASS: anonymous '+expected+' post'+(imagePath?' and image access':'')+'.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
