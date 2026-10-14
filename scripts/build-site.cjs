require('./build-board.cjs');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
// Only public site assets go into the deploy directory. The backend, SQL,
// .env, Git files, and protected administrator templates are excluded.
fs.mkdirSync(output, { recursive: true });
const files = ['index.html','login.html','blog.html','implant.html','implant-lifespan.html','implant-gum-bleeding.html','style.css','board.css','board.js','categories.js','category-filter.js','robots.txt','sitemap.xml','_redirects'];
for (const name of fs.readdirSync(root)) if (/^implant-.*\.svg$/.test(name)) files.push(name);
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(output, name));
for (const name of ['images','admin','blog']) fs.cpSync(path.join(root,name), path.join(output,name), { recursive:true });
console.log('Built public assets in dist; private CMS templates and server files stay excluded.');
