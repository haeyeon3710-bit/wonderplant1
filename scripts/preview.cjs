// Local preview with the same mappings as the Netlify deployment.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
const rules = fs.readFileSync(path.join(root, '_redirects'), 'utf8').trim().split(/\r?\n/).map(line => line.split(/\s+/).map(decodeURI));
const normalizePath = pathname => pathname.replace(/\/+$/, '') || '/';
const handler = (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const rule = rules.find(item => normalizePath(item[0]) === normalizePath(pathname));
  if (rule && rule[2] !== '200') { res.writeHead(parseInt(rule[2], 10), { Location: encodeURI(rule[1]) }).end(); return; }
  pathname = rule ? rule[1] : pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
};
module.exports = handler;
if (require.main === module) http.createServer(handler).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173/blog/'));
