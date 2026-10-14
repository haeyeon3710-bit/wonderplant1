const esbuild=require('esbuild');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
(async()=>{
  const out=path.join(root,'.netlify','qa');
  await esbuild.build({entryPoints:[path.join(root,'scripts/check-posts.cjs')],outfile:path.join(out,'posts.cjs'),platform:'node',format:'cjs',target:'node22',bundle:true,logLevel:'warning'});
  const result=execFileSync(process.execPath,['--no-experimental-require-module',path.join(out,'posts.cjs')],{encoding:'utf8'});process.stdout.write(result);
  await esbuild.build({entryPoints:[path.join(root,'netlify/functions/cms-posts.cjs')],outfile:path.join(out,'cms-posts.cjs'),platform:'node',format:'cjs',target:'node22',bundle:true,logLevel:'warning'});
  execFileSync(process.execPath,['--no-experimental-require-module','-e',"if(typeof require(process.argv[1]).handler!=='function')process.exit(1)",path.join(out,'cms-posts.cjs')]);
  await esbuild.build({entryPoints:[path.join(root,'netlify/functions/cms-public.cjs')],outfile:path.join(out,'cms-public.cjs'),platform:'node',format:'cjs',target:'node22',bundle:true,logLevel:'warning'});
  execFileSync(process.execPath,['--no-experimental-require-module','-e',"if(typeof require(process.argv[1]).handler!=='function')process.exit(1)",path.join(out,'cms-public.cjs')]);
  await esbuild.build({entryPoints:[path.join(root,'netlify/functions/cms-views.mjs')],outfile:path.join(out,'cms-views.mjs'),platform:'node',format:'esm',target:'node22',bundle:true,logLevel:'warning'});
  execFileSync(process.execPath,['--input-type=module','-e',"import {pathToFileURL} from 'node:url';const m=await import(pathToFileURL(process.argv[1]));if(typeof m.default!=='function')process.exit(1)",path.join(out,'cms-views.mjs')]);
  console.log('PASS: bundled CMS function and content tests load with Lambda experimental module support disabled.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
