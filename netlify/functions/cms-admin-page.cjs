const fs = require('node:fs');
const path = require('node:path');
const { requireAdmin, clearCookies } = require('../../lib/auth.cjs');
exports.handler = async event => {
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  try {
    const auth = await requireAdmin(event);
    const url = new URL(event.rawUrl || `https://${event.headers.host}${event.path}`);
    const template = /\/adm\/(new|edit)\/?$/.test(url.pathname) || url.pathname === '/editor.html' ? 'editor.html' : 'adm.html';
    return { statusCode: 200, headers, multiValueHeaders: auth.cookies.length ? { 'Set-Cookie': auth.cookies } : undefined, body: fs.readFileSync(path.join(process.cwd(), template), 'utf8') };
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
