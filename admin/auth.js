(() => {
  async function request(path, body) {
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.message || '서버 요청에 실패했습니다.'); error.status = response.status; throw error; }
    return data;
  }
  window.WonderfulAuth = { request, session: () => request('/api/auth/session'), login: (username, password) => request('/api/auth/login', { username, password }), logout: () => request('/api/auth/logout', {}), changePassword: (currentPassword, newPassword) => request('/api/auth/password', { currentPassword, newPassword }) };
})();
