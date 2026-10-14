'use strict';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function response(statusCode, data, cookies = []) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    multiValueHeaders: cookies.length ? { 'Set-Cookie': cookies } : undefined, body: data === null ? '' : JSON.stringify(data) };
}
function origin(event) { return new URL(event.rawUrl || `https://${event.headers.host}${event.path || '/'}`).origin; }
function requireMutation(event) {
  if (event.httpMethod !== 'POST') throw new HttpError(405, 'POST 요청이 필요합니다.');
  if (event.headers.origin !== origin(event)) throw new HttpError(403, '허용되지 않은 요청 출처입니다.');
  if (!(event.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'JSON 요청이 필요합니다.');
}
function jsonBody(event, limit = 1000000) {
  const text = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '{}';
  if (Buffer.byteLength(text) > limit) throw new HttpError(413, '요청 데이터가 너무 큽니다.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'JSON 데이터를 읽을 수 없습니다.'); }
}
function failure(error, cookies = []) {
  return response(error instanceof HttpError ? error.status : 503, { message: error instanceof HttpError ? error.message : '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }, cookies);
}
module.exports = { HttpError, response, origin, requireMutation, jsonBody, failure };
