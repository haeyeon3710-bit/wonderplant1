const {configuration,client}=require('../../lib/supabase.cjs');
const {requireAdmin}=require('../../lib/auth.cjs');
exports.handler=async event=>{
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  try {
    if(!['GET','HEAD'].includes(event.httpMethod)) return {statusCode:405,headers,body:''};
    const config=configuration(); const api=client(config);
    const pathname=new URL(event.rawUrl||`https://${event.headers.host}${event.path}`).pathname;
    const path=pathname.replace(/^\/media\//,'');
    if(!new RegExp(`^${config.environment}/[a-z0-9/-]+\\.(png|jpg|jpeg|webp|gif)$`).test(path)) return {statusCode:404,headers,body:''};
    // A tiny signed redirect avoids the function response size limit for 20 MB images.
    let data,cookies=[];
    try {data=(await api.request('/storage/v1/object/sign/cms-images/'+path,{method:'POST',body:{expiresIn:60}})).data;}
    catch(error) {
      if(![400,401,403,404].includes(error.status)) throw error;
      const auth=await requireAdmin(event); cookies=auth.cookies;
      data=(await api.request('/storage/v1/object/sign/cms-images/'+path,{method:'POST',token:auth.token,body:{expiresIn:60}})).data;
    }
    const signed=new URL(config.url+'/storage/v1'+data.signedURL);
    if(signed.origin!==config.url) throw new Error('Invalid storage URL');
    return {statusCode:302,headers:{...headers,Location:signed.href},multiValueHeaders:cookies.length?{'Set-Cookie':cookies}:undefined,body:''};
  }catch(error){return {statusCode:[400,401,403,404].includes(error.status)?404:503,headers,body:''};}
};
