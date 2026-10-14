const {requireAdmin,clearCookies}=require('../../lib/auth.cjs');
const {configuration}=require('../../lib/supabase.cjs');
const {management}=require('../../lib/admin-data.cjs');
const {HttpError,requireMutation,jsonBody,response,failure}=require('../../lib/http.cjs');
exports.handler=async event=>{
 let auth;
 try{
  auth=await requireAdmin(event);const service=management(auth,configuration().environment);
  if(event.httpMethod==='GET'){
   if(event.queryStringParameters?.month!==undefined)return response(200,{dailyStats:await service.dailyViews(event.queryStringParameters.month)},auth.cookies);
   const [categories,statistics]=await Promise.all([service.categories(),service.statistics()]);return response(200,{categories,statistics},auth.cookies);
  }
  requireMutation(event);const body=jsonBody(event,10000);
  if(body.action!=='save-category')throw new HttpError(400,'지원하지 않는 관리 작업입니다.');
  return response(200,{category:await service.saveCategory(body.category)},auth.cookies);
 }catch(error){return failure(error,error.status===401||error.status===403?clearCookies():auth?.cookies||[]);}
};
