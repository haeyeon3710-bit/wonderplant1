(()=>{
 const page=document.querySelector('[data-post-id]');if(!page)return;
 async function record(){
  try{
   const result=await fetch('/api/views',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:page.dataset.postId}),credentials:'same-origin'});
   if(!result.ok)return;const data=await result.json();
   if(Number.isSafeInteger(data.viewCount)&&data.viewCount>=0)page.querySelectorAll('[data-view-count]').forEach(node=>node.textContent=data.viewCount.toLocaleString('ko-KR'));
  }catch{/* Statistics failure must not interrupt reading. */}
 }
 if(document.visibilityState==='visible')record();else document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')record();},{once:true});
})();
