'use strict';
const {escape}=require('./content.cjs');
const manifest=require('../content/images.manifest.json');
const entry=src=>manifest[src?.startsWith('images/')?'/'+src:src];
const optimizedSource=src=>entry(src)?.full.src||src;
function imageAttributes(src,card=false){
 const image=entry(src);if(!image)return `src="${escape(src)}" decoding="async"`;
 const selected=card?image.card:image.full;
 const srcset=image.card.src!==image.full.src?` srcset="${escape(image.card.src)} ${image.card.width}w, ${escape(image.full.src)} ${image.full.width}w" sizes="${card?'(max-width: 520px) 100vw, (max-width: 850px) 33vw, 380px':'(max-width: 850px) 100vw, 800px'}"`:'';
 return `src="${escape(selected.src)}"${srcset} decoding="async"`;
}
function optimizeHtml(html){
 return html.replace(/<img\b[^>]*>/g,tag=>{
  const src=tag.match(/\ssrc="([^"]+)"/)?.[1];if(!entry(src))return tag;
  // Only repo-owned, manifest-verified files are rewritten. User URLs stay intact.
  tag=tag.replace(/\s(?:srcset|sizes|decoding)="[^"]*"/g,'').replace(/\ssrc="[^"]*"/,' '+imageAttributes(src));
  if(!/\sloading=/.test(tag)&&!src.includes('logo')&&!src.includes('wordmark'))tag=tag.replace(/>$/,' loading="lazy">');
  return tag;
 });
}
module.exports={manifest,imageAttributes,optimizedSource,optimizeHtml};
