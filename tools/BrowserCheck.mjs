import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.DEMO_URL || 'http://127.0.0.1:9438';
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL}: {})});
const page = await browser.newPage();
const errors=[]; page.on('pageerror',_error=>errors.push(_error.message));
try {
 await page.goto(base); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Atlas ready'));
 await page.click('#enable'); await page.click('#loop');
 await page.waitForFunction(()=>document.querySelector('#activity').textContent.includes('1'));
 await page.waitForTimeout(1400); assert.match(await page.textContent('#activity'),/1/);
 await page.click('#land'); await page.waitForFunction(()=>document.querySelector('#activity').textContent.endsWith('0'));
 for(const failure of ['missing-json','missing-audio','bad-json','bad-audio','bad-loop']) {
  await page.click(`[data-failure="${failure}"]`);
  await page.waitForFunction(()=>document.querySelector('#status').dataset.error==='true');
  assert.equal(await page.isDisabled('#coin'),true);
  await page.click('#load');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Atlas ready'));
 }
 const signal = await page.evaluate(async()=>{
  const {AtlasPlayer}=await import('./generated/AtlasPlayer.mjs');
  const offline=new OfflineAudioContext(1,24000*3,24000);
  // Use real audio nodes with a running facade for deterministic offline rendering.
  const context={state:'running',destination:offline.destination,createGain:()=>offline.createGain(),createBuffer:(...a)=>offline.createBuffer(...a),createBufferSource:()=>offline.createBufferSource()};
  const player=new AtlasPlayer(context);player.SetVolume(1);
  player.buffer=offline.createBuffer(1,24000*2,24000);
  const data=player.buffer.getChannelData(0);data.fill(0.2,0,2400);data.fill(0.4,2400,14400);data.fill(0.1,14400,19200);data.fill(-0.8,19200);
  player.atlas={schemaVersion:1,sounds:{fly:[0,0.8,0.1,0.6]}};
  const source=player.Play('fly');
  const paused=offline.suspend(1.15);const rendering=offline.startRendering();
  await paused;player.Stop(source);player.Stop(source);await offline.resume();
  const output=(await rendering).getChannelData(0);
  const at=t=>output[Math.round(t*24000)];
  return {attack:at(0.05),loop:at(0.3),stillLoop:at(0.95),release:at(1.65),silence:at(2.2),nextCueLeaked:output.some(v=>v< -0.1)};
 });
 assert.ok(Math.abs(signal.attack-0.2)<0.001);assert.ok(Math.abs(signal.loop-0.4)<0.001);
 assert.ok(Math.abs(signal.stillLoop-0.4)<0.001);assert.ok(Math.abs(signal.release-0.1)<0.001);
 assert.equal(signal.silence,0);assert.equal(signal.nextCueLeaked,false);
 const decoding=await page.evaluate(async()=>{
  const context=new AudioContext({sampleRate:48000});const rows=[];
  for(const ext of ['wav','weba']) {
   const raw=await (await fetch('/generated/effects.'+ext)).arrayBuffer();const buffer=await context.decodeAudioData(raw);
   rows.push({format:ext,duration:buffer.duration,sampleRate:buffer.sampleRate,frames:buffer.length});
  }
  await context.close();return rows;
 });
 assert.equal(decoding[0].frames,decoding[1].frames,'WAV/WebA must decode to the same frame count');
 const alignment=await page.evaluate(async()=>{
  const context=new AudioContext({sampleRate:48000});
  try {
   const buffers=await Promise.all(['wav','weba'].map(async ext=>context.decodeAudioData(await(await fetch('/generated/effects.'+ext)).arrayBuffer())));
   const a=buffers[0].getChannelData(0),b=buffers[1].getChannelData(0);
   let aa=0,bb=0,ab=0;
   for(let i=0;i<a.length;i++){aa+=a[i]*a[i];bb+=b[i]*b[i];ab+=a[i]*b[i];}
   return ab/Math.sqrt(aa*bb);
  }finally{await context.close();}
 });
 assert.ok(alignment>0.95,'Decoded WebA must remain aligned to the WAV cue timeline');
 await fs.mkdir('measurements',{recursive:true});
 await fs.writeFile('measurements/browser-check.json',JSON.stringify({at:new Date().toISOString(),browser:await browser.version(),signal,decoding,alignment,errors},null,2));
 assert.deepEqual(errors,[]);
 for(const profile of [{id:'localhost',latency:0,downloadThroughput:-1,uploadThroughput:-1},{id:'simulated-100ms-10mbps',latency:100,downloadThroughput:1250000,uploadThroughput:1250000}]) {
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:profile.latency,downloadThroughput:profile.downloadThroughput,uploadThroughput:profile.uploadThroughput});
  const report=await page.evaluate(async()=>{
   const {RunBenchmark}=await import('./Benchmark.mjs');
   const manifest=await (await fetch('/generated/benchmark/cases.json')).json();
   const context=new AudioContext({sampleRate:48000});
   try{return await RunBenchmark(context,manifest,5,6);}finally{await context.close();}
  });
  report.networkProfile=profile;report.browser=await browser.version();
  for(const round of [0,1,2,3,4])for(const kind of ['individual','atlas']) {
   const rows=report.rows.filter(row=>row.round===round&&row.case.startsWith(kind));
   assert.equal(rows[0].retainedPcmBytes,rows[1].retainedPcmBytes,'Benchmark PCM durations must match across codecs');
  }
  await fs.writeFile('measurements/'+profile.id+'.json',JSON.stringify(report,null,2));
  await cdp.detach();
  console.log(profile.id,JSON.stringify(report.manifest.cases.map(item=>{
   const rows=report.rows.filter(row=>row.case===item.id),times=rows.map(row=>row.readyMs).sort((a,b)=>a-b);
   return {case:item.id,medianMs:times[2],payloadBytes:rows[0].payloadBytes,pcmBytes:rows[0].retainedPcmBytes};
  })));
 }
 console.log('Browser playback, five recovery paths, offline attack/loop/release and two benchmark profiles passed.');
} finally {await browser.close();}
