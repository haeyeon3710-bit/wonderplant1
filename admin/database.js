(() => {
  const Auth=window.WonderfulAuth;
  let posts=[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function update(post){const i=posts.findIndex(p=>p.id===post.id);if(i<0)posts.unshift(post);else posts[i]=post;return clone(post);}
  async function upload(file) {
    if(!file || !['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size>20*1024*1024 || !file.size) throw new Error('PNG, JPG, WebP, GIF 이미지를 파일당 20MB 이하로 선택해 주세요.');
    const local=URL.createObjectURL(file);
    try { await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(new Error('이미지 파일을 읽을 수 없습니다.'));image.src=local;}); }
    finally {URL.revokeObjectURL(local);}
    const signed=await Auth.request('/api/upload',{type:file.type,size:file.size});
    const result=await fetch(signed.uploadUrl,{method:'PUT',body:file,headers:{'Content-Type':file.type,'x-upsert':'false','Cache-Control':'max-age=60'}});
    if(!result.ok) throw new Error('이미지 업로드에 실패했습니다. 20MB 한도와 연결 상태를 확인해 주세요.');
    return signed.src;
  }
  async function prepare(post) {
    const result=clone(post);
    const dataImage=async value=>{
      if(!value?.startsWith('data:image/'))return value;
      const response=await fetch(value);return upload(await response.blob());
    };
    result.thumbnail=await dataImage(result.thumbnail);
    for(const block of result.blocks)if(block.type==='image')block.src=await dataImage(block.src);
    return result;
  }
  window.WonderfulDatabase={
    upload,
    async load(){const data=await Auth.request('/api/posts');posts=data.posts;if(!Array.isArray(data.categories))throw new Error('카테고리를 불러오지 못했습니다.');window.WonderfulAdmin.categories.splice(0,window.WonderfulAdmin.categories.length,...data.categories);return this.all();},
    all(){return clone(posts);},
    async get(id){return update((await Auth.request('/api/posts?id='+encodeURIComponent(id))).post);},
    async save(post){const prepared=await prepare(post);return update((await Auth.request('/api/posts',{action:'save',post:prepared})).post);},
    async copy(id){return update((await Auth.request('/api/posts',{action:'copy',id})).post);},
    async remove(id,version){await Auth.request('/api/posts',{action:'delete',id,version});posts=posts.filter(p=>p.id!==id);},
    async importDraft(post){const id=crypto.randomUUID();return this.save({...post,id,version:undefined,legacyId:undefined,status:'draft',scheduledAt:null,slug:window.WonderfulAdmin.slugify(post.slug||post.title||'가져온-초안').slice(0,61)+'-가져오기-'+id.slice(0,8),thumbnailAlt:post.thumbnailAlt||'',thumbnail:post.thumbnail||'',summary:post.summary||'',category:post.category||(post.id==='2'?'complex-implant':'implant')});}
  };
})();
