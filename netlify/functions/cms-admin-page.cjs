const fs = require('node:fs');
const path = require('node:path');
const { requireAdmin, clearCookies } = require('../../lib/auth.cjs');
const {configuration,client}=require('../../lib/supabase.cjs');
const {initialData,embed}=require('../../lib/admin-bootstrap.cjs');
const {optimizeHtml}=require('../../lib/images.cjs');
const templates=new Map();
exports.handler = async event => {
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  try {
    const url = new URL(event.rawUrl || `https://${event.headers.host}${event.path}`);
    const config=configuration(),start=performance.now();
    const auth=await requireAdmin(event,client(config),async(token,api)=>{
      const data=await initialData(token,api,config,url);
      return {user:data.user,data};
    });
    const verified=performance.now();
    const template = /\/adm\/(new|edit)\/?$/.test(url.pathname) || url.pathname === '/editor.html' ? 'editor.html' : 'adm.html';
    const data=auth.initial;
    if(!templates.has(template))templates.set(template,optimizeHtml(fs.readFileSync(path.join(process.cwd(),template),'utf8')));
    headers['Server-Timing']=`verified_snapshot;dur=${(verified-start).toFixed(1)}, render;dur=${(performance.now()-verified).toFixed(1)}`;
    return { statusCode: 200, headers, multiValueHeaders: auth.cookies.length ? { 'Set-Cookie': auth.cookies } : undefined, body: templates.get(template).replace('</body>',embed(data)+'</body>') };
  } catch (error) {
    if (error.status === 401) {
      const url = new URL(event.rawUrl || `https://${event.headers.host}${event.path}`);
      const next = /^\/adm(?:\/|$)/.test(url.pathname) ? url.pathname + url.search : '/adm';
      return { statusCode: 303, headers: { ...headers, Location: '/login?next=' + encodeURIComponent(next) }, multiValueHeaders: { 'Set-Cookie': clearCookies() }, body: '' };
    }
    const denied = error.status === 403;
    return { statusCode: denied ? 403 : 503, headers, body: `<!doctype html><html lang="ko"><meta charset="utf-8"><title>관리자 접근 안내</title><h1>${denied ? '관리자 권한이 없습니다.' : '관리 서버에 연결할 수 없습니다.'}</h1><p><a href="/login">로그인 화면으로</a></p></html>` };
  }
};
