require('./build-board.cjs');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
// Only public site assets go into the deploy directory. The backend, SQL,
// .env, Git files, and protected administrator templates are excluded.
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw new Error('Invalid generated output directory.');
if(fs.existsSync(output)){
  if(fs.realpathSync(output)!==output)throw new Error('Refusing to remove a linked output directory.');
  fs.rmSync(output,{recursive:true,force:true});
}
fs.mkdirSync(output, { recursive: true });
const files = ['login.html','policy.html','style.css','board.css','cms-public.css','board.js','categories.js','category-filter.js','post-views.js','_redirects'];
for (const name of fs.readdirSync(root)) if (/^implant-.*\.svg$/.test(name)) files.push(name);
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(output, name));
fs.cpSync(path.join(root,'images'),path.join(output,'images'),{recursive:true});
fs.mkdirSync(path.join(output,'admin'));
for(const name of ['admin.css','model.js','auth.js','database.js','management.js','app.js'])fs.copyFileSync(path.join(root,'admin',name),path.join(output,'admin',name));
console.log('Built public assets in dist; article/admin templates, seeds, server files and SQL stay excluded.');
