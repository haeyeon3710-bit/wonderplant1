'use strict';
const crypto=require('node:crypto'),sharp=require('sharp');
const {HttpError}=require('./http.cjs');
const limit=20*1024*1024;
const signedURL=(config,relative)=>{const url=new URL(config.url+'/storage/v1'+relative);if(url.origin!==config.url)throw new Error('Invalid storage URL');return url.href;};
async function convert(buffer){
 if(!buffer.length||buffer.length>limit)throw new HttpError(413,'원본 이미지는 20MB 이하여야 합니다.');
 const options={animated:true,limitInputPixels:100000000};let meta;
 try{meta=await sharp(buffer,options).metadata();}catch{throw new HttpError(400,'GIF/WebP 이미지를 읽지 못했습니다. 원본은 비공개로 보존됩니다.');}
 if(!['gif','webp'].includes(meta.format))throw new HttpError(400,'GIF 또는 움직이는 WebP 이미지를 선택해 주세요.');
 let output;
 try{output=await sharp(buffer,options).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:4,loop:meta.loop??1,...(meta.delay?{delay:meta.delay}:{})}).toBuffer();}
 catch{throw new HttpError(400,'이미지 변환에 실패했습니다. 원본은 비공개로 보존됩니다.');}
 if(output.length>limit)throw new HttpError(413,'변환된 이미지가 20MB를 넘습니다. 더 짧거나 작은 이미지를 선택해 주세요. 원본은 보존됩니다.');
 const converted=await sharp(output,{animated:true}).metadata();
 if((meta.pages||1)>1&&(converted.pages||1)<2)throw new HttpError(503,'애니메이션 보존을 확인하지 못했습니다. 원본은 보존됩니다.');
 return {buffer:output,width:converted.width,height:converted.pageHeight||converted.height,frames:converted.pages||1};
}
async function optimize(auth,config,src,fetchImpl=fetch){
 const expected=new RegExp(`^/media/${config.environment}/${auth.user.id}/[a-f0-9-]{36}\\.(gif|webp)$`);
 if(typeof src!=='string'||!expected.test(src))throw new HttpError(400,'현재 관리자가 업로드한 GIF/WebP 파일만 변환할 수 있습니다.');
 const path=src.slice(7),download=(await auth.api.request('/storage/v1/object/sign/cms-images/'+path,{method:'POST',token:auth.token,body:{expiresIn:60}})).data;
 const response=await fetchImpl(signedURL(config,download.signedURL),{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new HttpError(503,'원본 이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
 if(Number(response.headers.get('content-length'))>limit)throw new HttpError(413,'원본 이미지는 20MB 이하여야 합니다.');
 const converted=await convert(Buffer.from(await response.arrayBuffer())),outputPath=`${config.environment}/${auth.user.id}/${crypto.randomUUID()}.webp`;
 const signed=(await auth.api.request('/storage/v1/object/upload/sign/cms-images/'+outputPath,{method:'POST',token:auth.token,body:{}})).data;
 const uploaded=await fetchImpl(signedURL(config,signed.url),{method:'PUT',body:converted.buffer,headers:{'Content-Type':'image/webp','x-upsert':'false','Cache-Control':'max-age=60'},signal:AbortSignal.timeout(20000)});
 if(!uploaded.ok)throw new HttpError(503,'변환된 이미지 업로드에 실패했습니다. 원본은 보존됩니다.');
 return {src:'/media/'+outputPath,bytes:converted.buffer.length,width:converted.width,height:converted.height,frames:converted.frames};
}
module.exports={convert,optimize};
