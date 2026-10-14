'use strict';
const { client, configuration } = require('./supabase.cjs');
const { HttpError } = require('./http.cjs');
const ACCESS = '__Host-cms-access';
const REFRESH = '__Host-cms-refresh';
function cookies(session) {
  const ttl = Math.max(1, Number(session.expires_in) || 3600);
  return [
    `${ACCESS}=${encodeURIComponent(session.access_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`,
    `${REFRESH}=${encodeURIComponent(session.refresh_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`,
  ];
}
function clearCookies() { return [ACCESS, REFRESH].map(name => `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); }
function readCookies(event) {
  const map = {};
  for (const part of (event.headers.cookie || '').split(';')) {
    const split = part.indexOf('='); if (split < 0) continue;
    try { map[part.slice(0, split).trim()] = decodeURIComponent(part.slice(split + 1).trim()); } catch { /* invalid cookie */ }
  }
  return map;
}
function validateUsername(username) {
  if (typeof username !== 'string' || !/^[a-z0-9_]{3,40}$/.test(username)) throw new HttpError(400, '아이디를 확인해 주세요.');
  return username;
}
async function requireAdmin(event, api = client(configuration())) {
  const tokens = readCookies(event);
  let token = tokens[ACCESS]; let user; let updatedCookies = [];
  if (token) {
    try { user = (await api.request('/auth/v1/user', { token })).data; }
    catch (error) { if (error.status !== 401 && error.status !== 403) throw error; }
  }
  if (!user && tokens[REFRESH]) {
    try {
      const session = (await api.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: tokens[REFRESH] } })).data;
      token = session.access_token; updatedCookies = cookies(session);
      user = (await api.request('/auth/v1/user', { token })).data;
    } catch (error) {
      if (error.status === 400 || error.status === 401 || error.status === 403) throw new HttpError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
      throw error;
    }
  }
  if (!user || !/^[a-f0-9-]{36}$/i.test(user.id)) throw new HttpError(401, '관리자 로그인이 필요합니다.');
  const roles = (await api.request(`/rest/v1/admin_users?user_id=eq.${user.id}&select=user_id,role,username&limit=1`, { token })).data;
  const role = roles?.find(row => row.role === 'admin');
  if (!role) throw new HttpError(403, '관리자 권한이 없습니다.');
  return { user: { id: user.id, username: role.username || user.email?.split('@')[0] || 'admin' }, email: user.email, token, cookies: updatedCookies, api };
}
async function signIn(username, password, api = client(configuration())) {
  validateUsername(username);
  if (typeof password !== 'string' || !password || password.length > 256) throw new HttpError(400, '비밀번호를 입력해 주세요.');
  let session;
  try { session = (await api.request('/functions/v1/cms-login', { method: 'POST', body: { username, password } })).data; }
  catch (error) { if (error.status === 400 || error.status === 401 || error.status === 422) throw new HttpError(401, '아이디 또는 비밀번호를 확인해 주세요.'); throw error; }
  const event = { headers: { cookie: `${ACCESS}=${session.access_token}` } };
  const admin = await requireAdmin(event, api);
  if (admin.user.username !== username) throw new HttpError(403, '관리자 계정 설정을 확인해 주세요.');
  return { ...admin, cookies: cookies(session) };
}
module.exports = { ACCESS, REFRESH, cookies, clearCookies, readCookies, validateUsername, requireAdmin, signIn };
