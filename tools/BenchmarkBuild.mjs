import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Wave,WebA,Synthesize} from './Build.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/generated/benchmark');
await fs.mkdir(ROOT,{recursive:true});
const rate=48000, samples=[], sounds={}, cases=[];
const individual={wav:[],weba:[]}, bytes={wav:0,weba:0};
for(let i=0;i<32;i++) {
 const name='sound'+String(i).padStart(2,'0');
 const pcm=Synthesize(rate,160+i*37,0.2+(i%7)*0.1);
 sounds[name]=[samples.length/rate,pcm.length/rate,-1,-1];
 samples.push(...pcm); for(let n=0;n<rate*0.08;n++)samples.push(0);
 for(const [format,data] of [['wav',Wave(pcm,rate)],['weba',await WebA(pcm,rate)]]) {
  await fs.writeFile(path.join(ROOT,name+'.'+format),data);
  individual[format].push('/generated/benchmark/'+name+'.'+format);bytes[format]+=data.length;
 }
}
const json=JSON.stringify({schemaVersion:1,sounds});await fs.writeFile(path.join(ROOT,'atlas.json'),json);
for(const [format,data] of [['wav',Wave(samples,rate)],['weba',await WebA(samples,rate)]]) {
 await fs.writeFile(path.join(ROOT,'atlas.'+format),data);
 cases.push({id:'individual-'+format,audio:individual[format],bytes:bytes[format]});
 cases.push({id:'atlas-'+format,audio:['/generated/benchmark/atlas.'+format],json:'/generated/benchmark/atlas.json',bytes:data.length+Buffer.byteLength(json)});
}
const manifest={sounds:32,sampleRate:rate,encoder:'ffmpeg-static 5.2.0 / libopus; Opus 64 kbit/s mono',gapSeconds:0.08,source:'Identical deterministic synthetic PCM for all cases. No recordings. No deduplication.',cases};
await fs.writeFile(path.join(ROOT,'cases.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
