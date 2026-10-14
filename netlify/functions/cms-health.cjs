const { configuration, client } = require('../../lib/supabase.cjs');
exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  try {
    const health = await client(configuration()).health();
    return { statusCode: 200, headers, body: JSON.stringify(health) };
  } catch {
    return { statusCode: 503, headers, body: JSON.stringify({ connected: false, message: 'Supabase connection is not available.' }) };
  }
};
