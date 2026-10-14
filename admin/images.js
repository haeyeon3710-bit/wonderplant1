(()=>{
 'use strict';
 const limit=20*1024*1024;
 function validate(file){if(!file||!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>limit||file.size<=0)throw new Error('PNG, JPG, WebP, GIF 이미지를 파일당 20MB 이하로 선택해 주세요.');}
 async function prepare(file){
  validate(file);
  let animatedWebp=false;
  if(file.type==='image/webp'){
   const header=new Uint8Array(await file.slice(0,30).arrayBuffer());
   animatedWebp=String.fromCharCode(...header.slice(12,16))==='VP8X'&&Boolean(header[20]&2);
  }
  // Animation is converted on the authenticated server, never flattened by canvas.
  if(file.type==='image/gif'||animatedWebp)return {file,originalBytes:file.size,converted:false,server:true};
  const url=URL.createObjectURL(file),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('이미지 파일을 읽을 수 없습니다.'));image.src=url;});
   const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
   const context=canvas.getContext('2d');if(!context)throw new Error('이미지 변환을 시작하지 못했습니다.');
   context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.84));
   if(!blob||blob.type!=='image/webp')throw new Error('이 브라우저는 WebP 변환을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 업로드해 주세요.');
   const converted=new File([blob],file.name.replace(/\.[^.]*$/,'')+'.webp',{type:'image/webp',lastModified:file.lastModified});
   validate(converted);return {file:converted,originalBytes:file.size,converted:true,width:canvas.width,height:canvas.height};
  }finally{URL.revokeObjectURL(url);}
 }
 window.WonderfulImages={prepare,validate};
})();
