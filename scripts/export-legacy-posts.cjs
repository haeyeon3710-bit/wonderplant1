const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'admin/seed.js'),'utf8'),context);
const files={'1':'implant-lifespan.html','2':'implant-gum-bleeding.html'};
const records=context.window.WonderfulSeed.map(post=>{
  const html=fs.readFileSync(path.join(root,files[post.id]),'utf8');
  const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const article=html.match(/<article[^>]*>[\s\S]*?<\/article>/)[0].replace(/\b(href|src)="([^"]+)"/g,(match,attribute,url)=>/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url)?match:`${attribute}="/${url}"`);
  return {legacy_id:post.id,title:post.title,slug:post.slug,summary:post.summary,content:post.blocks,thumbnail:post.thumbnail,thumbnail_alt:post.thumbnailAlt,category_id:post.category,
    legacy_article_html:article,original_schema:schema,published_at:schema.datePublished,created_at:schema.datePublished};
});
const backup=path.join(root,'content/legacy-posts.backup.json');
if(!fs.existsSync(backup)) fs.writeFileSync(backup,JSON.stringify(records,null,2)+'\n');
else if(JSON.stringify(JSON.parse(fs.readFileSync(backup,'utf8')))!==JSON.stringify(records)) throw new Error('Original backup differs; preserve it and inspect before migration.');
const literal=JSON.stringify(records).replace(/'/g,"''");
const sql=`begin;
insert into public.posts(environment,legacy_id,title,slug,summary,content,legacy_article_html,original_schema,thumbnail,thumbnail_alt,category_id,status,created_by,created_at,published_at)
select 'preview',p.legacy_id,p.title,p.slug,p.summary,p.content,p.legacy_article_html,p.original_schema,p.thumbnail,p.thumbnail_alt,p.category_id,'published',
 (select user_id from public.admin_users where username='yammo0516'),p.created_at,p.published_at
from jsonb_to_recordset('${literal}'::jsonb) as p(legacy_id text,title text,slug text,summary text,content jsonb,legacy_article_html text,original_schema jsonb,thumbnail text,thumbnail_alt text,category_id text,created_at timestamptz,published_at timestamptz)
on conflict(environment,legacy_id) do nothing;
commit;`;
fs.writeFileSync(path.join(root,'supabase/legacy-posts.import.sql'),sql+'\n');
console.log(JSON.stringify({backup:'content/legacy-posts.backup.json',posts:records.map(p=>({id:p.legacy_id,category:p.category_id,publishedAt:p.published_at,htmlLength:p.legacy_article_html.length,starts:p.legacy_article_html.slice(0,150)}))}));
