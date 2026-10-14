const {configuration}=require('../../lib/supabase.cjs');
const {requireAdmin,clearCookies}=require('../../lib/auth.cjs');
const {requireMutation,jsonBody,response,failure}=require('../../lib/http.cjs');
const {optimize}=require('../../lib/animated-image.cjs');
exports.handler=async event=>{
 let auth;
 try{requireMutation(event);auth=await requireAdmin(event);const body=jsonBody(event,2000);return response(200,await optimize(auth,configuration(),body.src),auth.cookies);}
 catch(error){return failure(error,[401,403].includes(error.status)?clearCookies():auth?.cookies||[]);}
};
