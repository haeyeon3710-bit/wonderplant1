const { requireAdmin, signIn, clearCookies } = require('../../lib/auth.cjs');
const { HttpError, response, requireMutation, jsonBody, failure } = require('../../lib/http.cjs');
exports.handler = async event => {
  let auth;
  try {
    const path = new URL(event.rawUrl || `https://${event.headers.host}${event.path}`).pathname;
    if (path.endsWith('/session')) {
      if (event.httpMethod !== 'GET') throw new HttpError(405, 'GET 요청이 필요합니다.');
      auth = await requireAdmin(event); return response(200, { user: auth.user }, auth.cookies);
    }
    requireMutation(event);
    if (path.endsWith('/login')) {
      const body = jsonBody(event, 10000);
      auth = await signIn(String(body.username || '').trim().toLowerCase(), body.password);
      return response(200, { user: auth.user }, auth.cookies);
    }
    auth = await requireAdmin(event);
    if (path.endsWith('/logout')) {
      await auth.api.request('/auth/v1/logout', { method: 'POST', token: auth.token });
      return response(200, { success: true }, clearCookies());
    }
    if (path.endsWith('/password')) {
      const body = jsonBody(event, 10000);
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 6 || body.newPassword.length > 256) throw new HttpError(400, '새 비밀번호를 6자 이상으로 입력해 주세요.');
      let verified;
      try { verified = await signIn(auth.user.username, body.currentPassword); }
      catch(error) { if(error.status===401)throw new HttpError(400,'현재 비밀번호를 확인해 주세요.');throw error; }
      await verified.api.request('/auth/v1/user', { method: 'PUT', token: verified.token, body: { password: body.newPassword } });
      const renewed = await signIn(auth.user.username, body.newPassword);
      return response(200, { success: true }, renewed.cookies);
    }
    throw new HttpError(404, '요청을 찾을 수 없습니다.');
  } catch (error) { return failure(error, error.status === 401 || error.status === 403 ? clearCookies() : auth?.cookies || []); }
};
