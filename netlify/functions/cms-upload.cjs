const crypto=require('node:crypto');
const {configuration}=require('../../lib/supabase.cjs');
const {requireAdmin,clearCookies}=require('../../lib/auth.cjs');
const {HttpError,response,requireMutation,jsonBody,failure}=require('../../lib/http.cjs');
exports.handler=async event=>{
  let auth;
  try {
    requireMutation(event); auth=await requireAdmin(event);
    const body=jsonBody(event,10000); const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
    if(!extensions[body.type] || !Number.isSafeInteger(body.size)||body.size<1||body.size>20*1024*1024) throw new HttpError(400,'PNG, JPG, WebP, GIF 이미지를 파일당 20MB 이하로 선택해 주세요.');
    const config=configuration(); const path=`${config.environment}/${auth.user.id}/${crypto.randomUUID()}.${extensions[body.type]}`;
    const data=(await auth.api.request('/storage/v1/object/upload/sign/cms-images/'+path,{method:'POST',token:auth.token,body:{}})).data;
    const signed=new URL(config.url+'/storage/v1'+data.url);
    if(signed.origin!==config.url||!signed.searchParams.has('token')) throw new Error('Invalid upload URL');
    return response(200,{uploadUrl:signed.href,src:'/media/'+path},auth.cookies);
  }catch(error){return failure(error,error.status===401||error.status===403?clearCookies():auth?.cookies||[]);}
};
