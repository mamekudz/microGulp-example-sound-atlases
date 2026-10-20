import test from 'node:test';
import assert from 'node:assert/strict';
import {AtlasPlayer,ValidateAtlas} from '../src/AtlasPlayer.mjs';
import {Build,ValidateConfig,ParseSoundName} from '../tools/Build.mjs';
const ATLAS={schemaVersion:1,sounds:{one:[0,0.2,-1,-1],loop:[0.3,0.5,0.4,0.6]}};
function BufferData(_channels=1,_length=24000,_rate=24000){const channels=Array.from({length:_channels},()=>new Float32Array(_length));return {duration:_length/_rate,length:_length,sampleRate:_rate,numberOfChannels:_channels,getChannelData(i){return channels[i];},copyToChannel(data,i){channels[i].set(data);}};}
function Context(){return {state:'running',destination:{},createBuffer:BufferData,createGain:()=>({gain:{value:0},connect(){},disconnect(){}}),createBufferSource:()=>({set buffer(value){if(this.assignedBuffer)throw Error('BUFFER_ALREADY_SET');this.assignedBuffer=value;},get buffer(){return this.assignedBuffer;},connect(){},disconnect(){},start(...args){this.args=args;},stop(){this.stopped=true;}}),async decodeAudioData(){return BufferData();},async resume(){this.state='running';},async close(){this.state='closed';}};}
function Fetch(){return Promise.resolve({ok:true,json:async()=>structuredClone(ATLAS),arrayBuffer:async()=>new ArrayBuffer(4)});}
test('generated WAV has valid sample counts, cue bounds and seamless loop endpoints',async()=>{
 const {wav,atlas,config}=await Build();assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(40),wav.length-44);
 ValidateAtlas(atlas,(wav.length-44)/2/config.sampleRate);
 const [start,duration]=atlas.sounds.fly;assert.equal(duration,0.8);assert.equal(wav.readInt16LE(44+Math.round(start*config.sampleRate)*2),0);
 assert.ok(Math.abs(wav.readInt16LE(44+Math.round((start+duration)*config.sampleRate)*2-2))<1000);
});
test('invalid configuration, timing and loops are rejected',()=>{
 assert.throws(()=>ValidateConfig({}),/CONFIG/);
 for(const cue of [[-1,1,-1,-1],[0,2,-1,-1],[0,1,0.8,0.4],[0,1,-1,0.2],[0,NaN,-1,-1]])assert.throws(()=>ValidateAtlas({schemaVersion:1,sounds:{bad:cue}},1));
});
test('one shots use duration; loops remain running without a duration argument',async()=>{
 const p=new AtlasPlayer(Context(),Fetch);await p.Load('json','audio');const one=p.Play('one');assert.deepEqual(one.args,[0,0,0.2]);
 const loop=p.Play('loop');assert.deepEqual(loop.args,[0,0]);assert.ok(Math.abs(loop.loopEnd-0.3)<1e-9);assert.equal(p.active.size,2);
 one.onended();assert.equal(p.active.size,1);p.StopAll(true);p.StopAll(true);assert.equal(p.active.size,0);assert.equal(loop.stopped,true);
});
test('gain, mute, unsupported cues and suspended contexts are handled',async()=>{
 const p=new AtlasPlayer(Context(),Fetch);await p.Load('j','a');p.SetVolume(0.3);p.SetMuted(true);assert.equal(p.master.gain.value,0);p.SetMuted(false);assert.equal(p.master.gain.value,0.3);
 assert.throws(()=>p.SetVolume(100));assert.throws(()=>p.Play('missing'));p.context.state='suspended';assert.throws(()=>p.Play('one'));await p.Enable();p.Play('one');
});
test('HTTP, JSON, decode and loop failures leave no stale playable atlas and allow recovery',async()=>{
 for(const kind of ['http','json','decode','loop']){
  const ctx=Context(),p=new AtlasPlayer(ctx,Fetch);await p.Load('j','a');const source=p.Play('loop');
  if(kind==='http')p.fetch=async()=>({ok:false,status:404});
  if(kind==='json')p.fetch=async()=>({ok:true,json:async()=>{throw Error('JSON');},arrayBuffer:async()=>new ArrayBuffer(1)});
  if(kind==='decode')ctx.decodeAudioData=async()=>{throw Error('DECODE');};
  if(kind==='loop')p.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,sounds:{bad:[0,0.1,0.2,0.1]}}),arrayBuffer:async()=>new ArrayBuffer(1)});
  await assert.rejects(p.Load('j','a'));assert.equal(source.stopped,true);assert.equal(p.buffer,null);assert.throws(()=>p.Play('one'));
  p.fetch=Fetch;ctx.decodeAudioData=async()=>(BufferData());await p.Load('j','a');assert.ok(p.Play('one'));
 }
});
test('superseded loads and disposed players cannot restore stale buffers',async()=>{
 let finish;const ctx=Context(),p=new AtlasPlayer(ctx,Fetch);ctx.decodeAudioData=()=>new Promise(r=>{finish=r;});
 const old=p.Load('j','a');await new Promise(r=>setTimeout(r,0));const rejected=assert.rejects(old,/SUPERSEDED/);
 ctx.decodeAudioData=async()=>(BufferData());await p.Load('j','a');finish(BufferData());await rejected;
 await p.Dispose();assert.equal(p.active.size,0);assert.equal(ctx.state,'closed');await assert.rejects(p.Load('j','a'),/DISPOSED/);
});

test('configuration rejects mistyped, unknown and out-of-range values',()=>{
 const good={sampleRate:24000,gapSeconds:0.08,volume:0.2,features:{loops:true,failureTests:true}};
 for(const change of [{sampleRate:0},{gapSeconds:-1},{volume:2},{volume:'0.2'},{features:{loops:'yes',failureTests:true}},{extra:true}])assert.throws(()=>ValidateConfig({...good,...change}));
 assert.equal(ValidateConfig({...good,features:{loops:false,failureTests:false}}).features.loops,false);
});
test('default fetch keeps its global receiver and failed starts clean up sources',async _t=>{
 const original=globalThis.fetch;_t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=function(){assert.equal(this,globalThis);return Fetch();};
 const ctx=Context(),p=new AtlasPlayer(ctx);await p.Load('j','a');
 let disconnected=false;
 ctx.createBufferSource=()=>({connect(){},disconnect(){disconnected=true;},start(){throw Error('START_FAILED');}});
 assert.throws(()=>p.Play('one'),/START_FAILED/);assert.equal(p.active.size,0);assert.equal(disconnected,true);
});

test('filename sample markers determine looping and reject malformed boundaries',()=>{
 assert.deepEqual(ParseSoundName('fly.ls.2400.le.14400.wav',19200),{name:'fly',loopStart:2400,loopEnd:14400});
 assert.equal(ParseSoundName('coin.wav',100).loopStart,-1);
 for(const name of ['fly.ls.x.le.4.wav','fly.ls.4.le.2.wav','fly.ls.0.le.101.wav'])assert.throws(()=>ParseSoundName(name,100),/FILENAME_LOOP/);
});
test('graceful loop stop is idempotent, retains the release and bounds the buffer',async()=>{
 const p=new AtlasPlayer(Context(),Fetch);await p.Load('j','a');
 const a=p.Play('loop'),b=p.Play('loop');assert.equal(a.buffer,b.buffer);assert.equal(a.buffer.duration,0.5);
 assert.ok(Math.abs(a.loopStart-0.1)<1e-9);assert.equal(a.loop,true);
 p.Stop(a);p.Stop(a);assert.equal(a.loop,false);assert.equal(a.stopped,undefined);assert.equal(p.active.size,2);
 a.onended();assert.equal(p.active.size,1);p.Stop(b,true);assert.equal(b.stopped,true);
});
