import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import http from './http.cjs';
import auth from './auth.cjs';
const {HttpError,requireMutation,jsonBody}=http;
const {ACCESS,REFRESH,readCookies}=auth;
export async function recordView(event,ip,config,secret,fetchImpl=fetch){
 requireMutation(event);const body=jsonBody(event,2048);
 if(typeof body.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(body.id))throw new HttpError(400,'게시글을 확인해 주세요.');
 // Excluding requests with administrator session cookies changes no privilege;
 // even a forged cookie only excludes that visitor's own statistics.
 const cookies=readCookies(event);if(cookies[ACCESS]||cookies[REFRESH])return {counted:false,reason:'admin-session'};
 const agent=event.headers['user-agent']||'';
 if(/bot|crawler|spider|headless|lighthouse/i.test(agent))return {counted:false,reason:'crawler'};
 if(!isIP(ip||'')||!/^[a-zA-Z0-9_-]{43}$/.test(secret||''))throw new HttpError(503,'조회 통계 설정을 확인해 주세요.');
 const visitorHash=createHmac('sha256',secret).update(config.environment+'\n'+ip+'\n'+agent.slice(0,512)).digest('hex');
 const result=await fetchImpl(config.url+'/functions/v1/cms-view',{method:'POST',headers:{apikey:config.key,'x-cms-view-secret':secret,'Content-Type':'application/json'},body:JSON.stringify({environment:config.environment,id:body.id,visitorHash}),signal:AbortSignal.timeout(12000)});
 if(!result.ok)throw new HttpError(503,'조회수를 기록하지 못했습니다.');return result.json();
}
