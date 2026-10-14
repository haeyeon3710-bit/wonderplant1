const {configuration}=require('../../lib/supabase.cjs');
const {publicData}=require('../../lib/public-data.cjs');
const {response,failure,HttpError}=require('../../lib/http.cjs');
const {cardsHTML,filterHTML,paginationHTML}=require('../../lib/render.cjs');
exports.handler=async event=>{
 try{if(event.httpMethod!=='GET')throw new HttpError(405,'GET 요청이 필요합니다.');const data=await publicData(configuration()).board(event.queryStringParameters||{});return response(200,{...data,cards:cardsHTML(data.posts,data.categories),filters:filterHTML(data),pagination:paginationHTML(data)});}
 catch(error){return failure(error);}
};
