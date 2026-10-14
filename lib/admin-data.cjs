const crypto=require('node:crypto');
const {HttpError}=require('./http.cjs');
function management(auth,environment){
 const request=(path,options={})=>auth.api.request(path,{...options,token:auth.token});
 const fields='id,name,slug,sort_order,is_active';
 return {
  async categories(){return (await request('/rest/v1/categories?select='+fields+'&order=sort_order,id')).data;},
  async statistics(){return (await request('/rest/v1/rpc/cms_admin_statistics',{method:'POST',body:{p_environment:environment}})).data;},
  async saveCategory(input){
   if(!input||typeof input.name!=='string'||![...input.name.trim()].length||[...input.name.trim()].length>50||typeof input.slug!=='string'||input.slug.length>80||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)||!Number.isSafeInteger(input.sort_order)||input.sort_order<0||input.sort_order>10000||typeof input.is_active!=='boolean')throw new HttpError(400,'카테고리 이름·영문 주소·순서·활성 상태를 확인해 주세요.');
   const body={name:input.name.trim(),slug:input.slug,sort_order:input.sort_order,is_active:input.is_active};
   if(input.id!==undefined&&(typeof input.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(input.id)))throw new HttpError(400,'카테고리를 확인해 주세요.');
   try{
    const result=await request('/rest/v1/categories?'+(input.id?'id=eq.'+input.id+'&':'')+'select='+fields,{method:input.id?'PATCH':'POST',body:input.id?body:{id:crypto.randomUUID(),...body},headers:{Prefer:'return=representation'}});
    if(!result.data?.length)throw new HttpError(404,'카테고리를 찾을 수 없습니다.');return result.data[0];
   }catch(error){if(error.code==='23505')throw new HttpError(409,'이미 사용 중인 카테고리 이름 또는 주소입니다.');throw error;}
  }
 };
}
module.exports={management};
