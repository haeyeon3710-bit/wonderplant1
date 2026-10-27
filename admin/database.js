(() => {
  const Auth=window.WonderfulAuth;
  let posts=[],initialPost=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function update(post){const i=posts.findIndex(p=>p.id===post.id);if(i<0)posts.unshift(post);else posts[i]=post;return clone(post);}
  async function upload(file) {
    if(!window.WonderfulImages)throw new Error('이미지 변환 기능을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    const optimized=await window.WonderfulImages.prepare(file);file=optimized.file;
    const signed=await Auth.request('/api/upload',{type:file.type,size:file.size});
    const result=await fetch(signed.uploadUrl,{method:'PUT',body:file,headers:{'Content-Type':file.type,'x-upsert':'false','Cache-Control':'max-age=60'}});
    if(!result.ok) throw new Error('이미지 업로드에 실패했습니다. 20MB 한도와 연결 상태를 확인해 주세요.');
    let src=signed.src,bytes=file.size,converted=optimized.converted,originalDeleted=false,cleanupWarning='';
    if(optimized.server){const result=await Auth.request('/api/optimize-image',{src:signed.src});src=result.src;bytes=result.bytes;converted=true;originalDeleted=result.originalDeleted===true;cleanupWarning=result.cleanupWarning||'';}
    window.WonderfulDatabase.lastUpload={originalBytes:optimized.originalBytes,bytes,converted,originalDeleted,cleanupWarning};return src;
  }
  async function prepare(post) {
    const result=clone(post);
    const migrated=new Map();
    const dataImage=async value=>{
      if(!value?.startsWith('data:image/'))return value;
      if(!migrated.has(value))migrated.set(value,(async()=>{const response=await fetch(value);const blob=await response.blob();return upload(new File([blob],'가져온-이미지.'+blob.type.split('/')[1],{type:blob.type}));})());return migrated.get(value);
    };
    result.thumbnail=await dataImage(result.thumbnail);
    for(const block of result.blocks)if(block.type==='image')block.src=await dataImage(block.src);
    return result;
  }
  window.WonderfulDatabase={
    upload,
    hydrate(data){
      if(!Array.isArray(data.categories)||!Array.isArray(data.posts))throw new Error('초기 게시글 데이터를 확인해 주세요.');
      posts=clone(data.posts);initialPost=data.post?clone(data.post):null;
      if(initialPost)update(initialPost);
      window.WonderfulAdmin.categories.splice(0,window.WonderfulAdmin.categories.length,...data.categories);
    },
    async load(){const data=await Auth.request('/api/posts');posts=data.posts;if(!Array.isArray(data.categories))throw new Error('카테고리를 불러오지 못했습니다.');window.WonderfulAdmin.categories.splice(0,window.WonderfulAdmin.categories.length,...data.categories);return this.all();},
    all(){return clone(posts);},
    async get(id,{initial=false}={}){if(initial&&initialPost&&(initialPost.id===id||String(initialPost.legacyId)===id)){const post=initialPost;initialPost=null;return clone(post);}return update((await Auth.request('/api/posts?id='+encodeURIComponent(id))).post);},
    async complete(post){
      if(Array.isArray(post.blocks))return clone(post);
      const full=await this.get(post.id);
      if(full.version!==post.version)throw new Error('다른 화면에서 글이 변경되었습니다. 목록을 새로고침해 주세요.');
      return full;
    },
    async exportAll(){const data=await Auth.request('/api/posts');if(!Array.isArray(data.posts))throw new Error('백업할 게시글을 불러오지 못했습니다.');return data.posts;},
    async save(post){const prepared=await prepare(post);return update((await Auth.request('/api/posts',{action:'save',post:prepared})).post);},
    async copy(id){return update((await Auth.request('/api/posts',{action:'copy',id})).post);},
    async remove(id,version){await Auth.request('/api/posts',{action:'delete',id,version});posts=posts.filter(p=>p.id!==id);},
    async importDraft(post){const id=crypto.randomUUID();return this.save({...post,id,version:undefined,legacyId:undefined,status:'draft',scheduledAt:null,slug:window.WonderfulAdmin.slugify(post.slug||post.title||'가져온-초안').slice(0,61)+'-가져오기-'+id.slice(0,8),thumbnailAlt:post.thumbnailAlt||'',thumbnail:post.thumbnail||'',summary:post.summary||'',category:post.category||(post.id==='2'?'complex-implant':'implant')});}
  };
})();
