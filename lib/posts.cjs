'use strict';
const crypto = require('node:crypto');
const M = require('../admin/model.js');
const { HttpError } = require('./http.cjs');
const { legacyHtml } = require('./content.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fields = 'id,legacy_id,title,slug,summary,content,legacy_article_html,thumbnail,thumbnail_alt,category_id,status,created_at,published_at,updated_at,view_count,version';
const count = value => [...value].length;
function validImage(src, environment) {
  if (!src) return true;
  if (typeof src !== 'string' || src.length > 2048 || /[\s<>"'\\]/.test(src)) return false;
  if (src.startsWith('/media/')) return new RegExp(`^/media/${environment}/[a-z0-9/-]+\\.(png|jpg|jpeg|webp|gif)$`).test(src);
  return /^\/(?!\/)[a-zA-Z0-9/_%.가-힣-]+$/.test(src) || /^https:\/\/[^\s<>"']+$/.test(src);
}
function dto(row) {
  return { id:row.id, legacyId:row.legacy_id, title:row.title, slug:row.slug, summary:row.summary,
    blocks:row.content, legacyHtml:legacyHtml(row.legacy_article_html), thumbnail:row.thumbnail, thumbnailAlt:row.thumbnail_alt,
    category:row.category_id, status:row.status, createdAt:row.created_at, publishedAt:row.published_at, updatedAt:row.updated_at,
    viewCount:Number(row.view_count), version:row.version };
}
function validate(input, environment) {
  if (!input || typeof input !== 'object' || !UUID.test(input.id)) throw new HttpError(400,'게시글 ID를 확인해 주세요.');
  const text = (name, max) => {
    if (typeof input[name] !== 'string' || count(input[name]) > max) throw new HttpError(400,'입력 길이를 확인해 주세요: '+name);
    return input[name].trim();
  };
  const title = text('title',100), slug = text('slug',80), summary = text('summary',130);
  if (!title || !slug || slug !== M.slugify(slug)) throw new HttpError(400,'제목과 한글·영문·숫자·하이픈 슬러그를 입력해 주세요.');
  if (typeof input.category !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.category)) throw new HttpError(400,'카테고리를 선택해 주세요.');
  if (!['draft','published','private'].includes(input.status)) throw new HttpError(400,'게시 상태를 확인해 주세요.');
  const thumbnail = text('thumbnail',2048), thumbnailAlt = text('thumbnailAlt',300);
  if (!validImage(thumbnail,environment)) throw new HttpError(400,'대표 이미지 주소를 확인해 주세요. 파일은 먼저 업로드해 주세요.');
  if (!Array.isArray(input.blocks) || input.blocks.length > 200) throw new HttpError(400,'본문 블록은 최대 200개입니다.');
  const content = input.blocks.map(block => {
    if (!block || !['text','heading','image'].includes(block.type)) throw new HttpError(400,'지원하지 않는 본문 블록입니다.');
    if (block.type !== 'image') {
      if (typeof block.text !== 'string' || count(block.text) > 100000) throw new HttpError(400,'글 블록의 길이를 확인해 주세요.');
      return {type:block.type,text:block.text};
    }
    if (typeof block.src !== 'string' || !validImage(block.src,environment) || typeof block.alt !== 'string' || count(block.alt)>300 || typeof (block.caption ?? '') !== 'string' || count(block.caption || '')>2000) throw new HttpError(400,'이미지 블록을 확인해 주세요.');
    return {type:'image',src:block.src,alt:block.alt,caption:block.caption || ''};
  });
  if (input.status === 'published') {
    if (count(summary)<120 || count(summary)>130) throw new HttpError(400,'발행할 카드 설명글은 공백 포함 120~130자로 입력해 주세요.');
    if (!thumbnail || !thumbnailAlt || !content.some(b=>b.type!=='image' && b.text.trim())) throw new HttpError(400,'대표 이미지·설명과 본문 글을 입력한 뒤 발행해 주세요.');
    if (content.some(b=>b.type==='image' ? !b.src || !b.alt.trim() : !b.text.trim())) throw new HttpError(400,'빈 본문 블록을 채우거나 삭제해 주세요.');
  }
  return {title,slug,summary,content,thumbnail,thumbnail_alt:thumbnailAlt,category_id:input.category,status:input.status};
}
function service(auth, environment) {
  const request = (path, options={}) => auth.api.request(path,{...options,token:auth.token});
  const query = suffix => `/rest/v1/posts?environment=eq.${environment}&${suffix}`;
  async function get(id) {
    if (typeof id !== 'string' || (!UUID.test(id) && !/^[0-9]{1,10}$/.test(id))) throw new HttpError(400,'게시글 ID를 확인해 주세요.');
    const row=(await request(query(`${UUID.test(id)?'id':'legacy_id'}=eq.${encodeURIComponent(id)}&select=${fields}&limit=1`))).data?.[0];
    if (!row) throw new HttpError(404,'게시글을 찾을 수 없습니다.'); return row;
  }
  async function save(post) {
    const values=validate(post,environment);
    const cats=(await request(`/rest/v1/categories?id=eq.${values.category_id}&is_active=eq.true&select=id`)).data;
    if (!cats?.length) throw new HttpError(400,'활성 카테고리를 선택해 주세요.');
    let result;
    try {
      if (post.version !== undefined && post.version !== null) {
        if (!Number.isSafeInteger(post.version) || post.version<1) throw new HttpError(400,'글 버전을 확인해 주세요.');
        const original=await get(post.id);
        // Keep the rich original HTML unless the actual builder content changes.
        const body={...values,legacy_article_html:JSON.stringify(original.content)===JSON.stringify(values.content)?original.legacy_article_html:null};
        result=await request(query(`id=eq.${post.id}&version=eq.${post.version}&select=${fields}`),{method:'PATCH',body,headers:{Prefer:'return=representation'}});
        if (!result.data?.length) throw new HttpError(409,'다른 화면에서 글이 변경되었습니다. 복구본을 보존한 후 새로고침해 주세요.');
      } else {
        if(post.legacyHtml!==undefined&&(typeof post.legacyHtml!=='string'||post.legacyHtml.length>500000))throw new HttpError(400,'백업 본문 형식을 확인해 주세요.');
        // A DB JSON backup must retain the complete original article. Imported
        // HTML is accepted only through the authenticated endpoint and sanitized.
        const clean=legacyHtml(post.legacyHtml);
        const restored=clean?(clean.startsWith('<article')?clean:'<article>'+clean+'</article>'):null;
        result=await request(`/rest/v1/posts?select=${fields}`,{method:'POST',body:{id:post.id,environment,created_by:auth.user.id,...values,legacy_article_html:restored},headers:{Prefer:'return=representation'}});
      }
    } catch(error) {
      if(error.code==='23505') throw new HttpError(409,'이미 사용 중인 주소입니다. 슬러그를 변경해 주세요.');
      if(error.code==='23514') throw new HttpError(400,'카테고리 또는 발행 조건을 확인해 주세요.'); throw error;
    }
    return dto(result.data[0]);
  }
  return {
    async list() {
      const rows=[];
      for(let offset=0;;offset+=500) {
        const batch=(await request(query(`select=${fields}&order=updated_at.desc,id&limit=500&offset=${offset}`))).data;
        if(!Array.isArray(batch)) throw new Error('Invalid posts response'); rows.push(...batch); if(batch.length<500) break;
      }
      return rows.map(dto);
    },
    get:async id=>dto(await get(id)), save,
    async remove(id,version) {
      if(!UUID.test(id)||!Number.isSafeInteger(version)) throw new HttpError(400,'글 ID와 버전을 확인해 주세요.');
      const rows=(await request(query(`id=eq.${id}&version=eq.${version}&select=id`),{method:'DELETE',headers:{Prefer:'return=representation'}})).data;
      if(!rows?.length) throw new HttpError(409,'글이 변경되었거나 이미 삭제되었습니다. 목록을 새로고침해 주세요.'); return {success:true};
    },
    async copy(id) {
      const original=await get(id); const newId=crypto.randomUUID();
      const body={ id:newId, environment,created_by:auth.user.id,title:(original.title+' (사본)').slice(0,100),slug:original.slug.slice(0,62)+'-사본-'+newId.slice(0,8),summary:original.summary,
        content:original.content,legacy_article_html:original.legacy_article_html,thumbnail:original.thumbnail,thumbnail_alt:original.thumbnail_alt,category_id:original.category_id,status:'draft' };
      const row=(await request(`/rest/v1/posts?select=${fields}`,{method:'POST',body,headers:{Prefer:'return=representation'}})).data?.[0]; return dto(row);
    }
  };
}
module.exports={UUID,fields,validImage,dto,validate,service};
