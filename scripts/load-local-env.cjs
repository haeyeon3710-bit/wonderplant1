const fs=require('node:fs');
const path=require('node:path');
const file=path.resolve(__dirname,'../.env');
if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const match=/^([A-Z_]+)=(.*)$/.exec(line);if(match&&process.env[match[1]]===undefined)process.env[match[1]]=match[2];}
