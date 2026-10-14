'use strict';
// No cached result is served until a fresh DB revision check has succeeded.
// Responses stay no-store at the browser/CDN; privacy changes cannot be bypassed.
function snapshotCache({now=Date.now,maxEntries=100,maxBytes=5*1024*1024}={}){
 const entries=new Map(),pending=new Map();let bytes=0;
 const clone=value=>JSON.parse(JSON.stringify(value));
 function trim(){for(const[key,entry]of entries)if(entry.expires<=now()){entries.delete(key);bytes-=entry.bytes;}while(entries.size>maxEntries||bytes>maxBytes){const key=entries.keys().next().value;bytes-=entries.get(key).bytes;entries.delete(key);}}
 async function read(namespace,parameters,revision,load){
  trim();const prefix=namespace+'\n'+JSON.stringify(parameters)+'\n';
  // The first/cold request uses one combined RPC, including its snapshot revision.
  const hasCached=[...entries.keys()].some(key=>key.startsWith(prefix));
  let version=hasCached?String(await revision()):null;
  if(version!==null&&!/^\d+$/.test(version))throw new Error('Invalid public revision');
  const key=prefix+(version??'initial');
  if(version!==null&&entries.has(key)){const entry=entries.get(key);entries.delete(key);entries.set(key,entry);return clone(entry.value);}
  if(!pending.has(key))pending.set(key,(async()=>{
   const result=await load();if(!/^\d+$/.test(String(result?.revision))||!result.data)throw new Error('Invalid public snapshot');
   const actualKey=prefix+result.revision,value=clone(result.data),size=Buffer.byteLength(JSON.stringify(value));
   if(entries.has(actualKey))bytes-=entries.get(actualKey).bytes;
   entries.set(actualKey,{value,bytes:size,expires:now()+30000});bytes+=size;trim();return value;
  })());
  try{return clone(await pending.get(key));}finally{pending.delete(key);}
 }
 return {read,clear(){entries.clear();pending.clear();bytes=0;}};
}
module.exports={snapshotCache,publicCache:snapshotCache()};
