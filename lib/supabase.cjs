'use strict';
function configuration(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase URL or publishable key is missing.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Invalid Supabase URL.');
  if (key.startsWith('sb_secret_')) throw new Error('A server secret key cannot be used as a publishable key.');
  if (key.split('.').length === 3) {
    try { if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role !== 'anon') throw new Error('not anon'); }
    catch { throw new Error('Only an anon or publishable key is allowed.'); }
  } else if (!key.startsWith('sb_publishable_')) throw new Error('Invalid publishable key.');
  if (!['preview', 'production'].includes(env.CMS_ENVIRONMENT)) throw new Error('CMS_ENVIRONMENT must be preview or production.');
  return { url: parsed.origin, key, environment: env.CMS_ENVIRONMENT, siteUrl: env.SITE_URL || '' };
}
function client(config = configuration(), fetchImpl = fetch) {
  return {
    async request(path, { token, method = 'GET', body, headers = {} } = {}) {
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path.');
      const auth = token ? { Authorization: 'Bearer ' + token } : {};
      const response = await fetchImpl(config.url + path, {
        method, headers: { apikey: config.key, 'Content-Type': 'application/json', ...auth, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
      });
      let data;
      const text = await response.text();
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!response.ok) {
        const error = new Error('Supabase request failed (' + response.status + ').');
        error.status = response.status; error.code = data?.code; error.path = path; error.reason = data?.message || data?.error_description || data?.error; throw error;
      }
      return { data, headers: response.headers, status: response.status };
    },
    async health() {
      const auth = await this.request('/auth/v1/settings');
      let schemaReady = false;
      try { await this.request('/rest/v1/categories?select=id&limit=1'); schemaReady = true; }
      catch (error) {
        // A reachable fresh project's missing table is expected before stage 2.
        // The OpenAPI root requires a secret key and is not a public health probe.
        if (error.status !== 404 || error.code !== 'PGRST205') throw error;
      }
      return { connected: auth.status === 200, authReachable: true, dataApiReachable: true, schemaReady, environment: config.environment };
    },
  };
}
module.exports = { configuration, client };
