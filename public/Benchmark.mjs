// File payload sizes are measured; HTTP headers and TLS overhead are excluded.
export async function RunBenchmark(_context, _manifest, _rounds=5, _concurrency=6) {
 const rows=[];
 for(let round=0;round<_rounds;round++) {
  // Rotate order to reduce a fixed first-case warm-up bias.
  for(let step=0;step<_manifest.cases.length;step++) {
   const item=_manifest.cases[(step+round)%_manifest.cases.length];
   let next=0, bytes=0, pcmBytes=0, decodeMs=0;
   const start=performance.now();
   const json=item.json?fetch(item.json,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw Error('HTTP_'+response.status);
    const raw=await response.arrayBuffer();bytes+=raw.byteLength;JSON.parse(new TextDecoder().decode(raw));
   }):Promise.resolve();
   await Promise.all([json,...Array.from({length:Math.min(_concurrency,item.audio.length)},async()=>{
    while(next<item.audio.length) {
     const url=item.audio[next++],response=await fetch(url,{cache:'no-store'});
     if(!response.ok)throw Error('HTTP_'+response.status);
     const data=await response.arrayBuffer();bytes+=data.byteLength;
     const before=performance.now(),buffer=await _context.decodeAudioData(data);
     decodeMs+=performance.now()-before;
     pcmBytes+=buffer.length*buffer.numberOfChannels*4;
    }
   })]);
   rows.push({case:item.id,round,readyMs:performance.now()-start,decodeTaskMs:decodeMs,payloadBytes:bytes,retainedPcmBytes:pcmBytes,requests:item.audio.length+(item.json?1:0),decodeCalls:item.audio.length});
  }
 }
 return {at:new Date().toISOString(),userAgent:navigator.userAgent,sampleRate:_context.sampleRate,rounds:_rounds,concurrency:_concurrency,transport:location.protocol+' localhost; cache:no-store; network profile must be recorded separately',manifest:_manifest,rows};
}
