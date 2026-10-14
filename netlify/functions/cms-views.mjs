import supabase from '../../lib/supabase.cjs';
import {recordView} from '../../lib/views.mjs';
import http from '../../lib/http.cjs';
// context.ip is Netlify's connection metadata, never a caller-supplied IP header.
export default async(request,context)=>{
 const event={httpMethod:request.method,rawUrl:request.url,headers:Object.fromEntries(request.headers),body:await request.text()};
 try{return Response.json(await recordView(event,context.ip,supabase.configuration(),process.env.CMS_VIEW_SECRET),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 catch(error){const result=http.failure(error);return new Response(result.body,{status:result.statusCode,headers:result.headers});}
};
