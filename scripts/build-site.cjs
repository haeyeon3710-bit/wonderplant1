require('./build-board.cjs');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/optimize-images.cjs')],{stdio:'inherit'});
const imageManifest=JSON.parse(fs.readFileSync(path.join(root,'content/images.manifest.json'),'utf8'));
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
fs.mkdirSync(path.join(output,'images','optimized'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'images'))){
 if(name==='optimized'||imageManifest['/images/'+name])continue;
 fs.copyFileSync(path.join(root,'images',name),path.join(output,'images',name));
}
for(const image of Object.values(imageManifest))for(const variant of [image.full,image.card])fs.copyFileSync(path.join(root,variant.src.slice(1)),path.join(output,variant.src.slice(1)));
fs.appendFileSync(path.join(output,'_redirects'),'\n'+Object.entries(imageManifest).map(([original,image])=>`${original} ${image.full.src} 301!`).join('\n')+'\n');
fs.writeFileSync(path.join(output,'_headers'),'/images/optimized/*\n  Cache-Control: public, max-age=31536000, immutable\n');
fs.mkdirSync(path.join(output,'admin'));
for(const name of ['admin.css','model.js','auth.js','images.js','database.js','daily-chart.js','management.js','app.js'])fs.copyFileSync(path.join(root,'admin',name),path.join(output,'admin',name));
console.log('Built public assets in dist; article/admin templates, seeds, server files and SQL stay excluded.');
