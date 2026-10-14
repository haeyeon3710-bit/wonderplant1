// Authenticated service bridge. No raw visitor information is accepted or stored.
// The service key stays in Supabase's built-in server environment.
Deno.serve(async(request:Request)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(request.method!=='POST')return reply(405,{message:'POST required'});
 try{
  const secret=request.headers.get('x-cms-view-secret')||'';
  if(!/^[a-zA-Z0-9_-]{43}$/.test(secret))return reply(403,{message:'Bridge authentication required'});
  const text=await request.text();if(text.length>2048)return reply(413,{message:'Request too large'});
  const body=JSON.parse(text);
  if(!['preview','production'].includes(body.environment)||!/^[a-f0-9-]{36}$/.test(body.id)||!/^[a-f0-9]{64}$/.test(body.visitorHash))return reply(400,{message:'Invalid view request'});
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const result=await fetch(url+'/rest/v1/rpc/cms_record_post_view',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_environment:body.environment,p_post_id:body.id,p_visitor_hash:body.visitorHash,p_secret:secret}),signal:AbortSignal.timeout(10000)});
  if(!result.ok)return reply(result.status===403?403:503,{message:'View request rejected'});
  return reply(200,await result.json());
 }catch{return reply(503,{message:'View recording unavailable'});}
});
