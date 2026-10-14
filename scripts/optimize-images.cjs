'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'images','optimized');
(async()=>{
 await fs.mkdir(directory,{recursive:true});const manifest={};let originalBytes=0,optimizedBytes=0;
 for(const name of (await fs.readdir(path.join(root,'images'))).sort()){
  if(!/\.(png|jpe?g)$/i.test(name))continue;
  const source=await fs.readFile(path.join(root,'images',name)),base=path.parse(name).name;
  const logo=/logo|wordmark/.test(name),meta=await sharp(source).metadata();
  const output=async(size)=>{
   const buffer=await sharp(source).rotate().resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp(logo?{lossless:true,effort:6}:{quality:86,effort:6}).toBuffer(),hash=crypto.createHash('sha256').update(buffer).digest('hex').slice(0,12),file=`${base}-${hash}-${size}.webp`;
   await fs.writeFile(path.join(directory,file),buffer);const details=await sharp(buffer).metadata();return {src:'/images/optimized/'+file,width:details.width,height:details.height,bytes:buffer.length};
  };
  const full=await output(1600),card=Math.max(meta.width,meta.height)>800?await output(800):full;
  manifest['/images/'+name]={originalBytes:source.length,originalSha256:crypto.createHash('sha256').update(source).digest('hex'),full,card};originalBytes+=source.length;optimizedBytes+=full.bytes;
 }
 await fs.writeFile(path.join(root,'content','images.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({images:Object.keys(manifest).length,originalBytes,optimizedBytes,reductionPercent:Math.round((1-optimizedBytes/originalBytes)*100)}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
