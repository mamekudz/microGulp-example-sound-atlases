import {RunBenchmark} from './Benchmark.mjs';
import {Trans} from './vendor/i18x-engine.mjs';
const Text=(_text,_values={})=>Trans(_text,_values,{lid:'en-US',formats:{}});
let downloadUrl;
document.querySelector('#run').addEventListener('click',async()=>{
 const button=document.querySelector('#run'),out=document.querySelector('#result');button.disabled=true;
 const context=new AudioContext();
 try {
  out.textContent=Text('Measuring...<context="audio demo"/>');
  const response=await fetch('/generated/benchmark/cases.json');if(!response.ok)throw Error('Run npm run benchmark:build first.');
  const report=await RunBenchmark(context,await response.json(),5,Number(document.querySelector('#concurrency').value));
  out.textContent=JSON.stringify(report,null,2);
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.querySelector('#download');link.href=downloadUrl;link.download='sound-atlas-benchmark.json';link.hidden=false;
 }catch(error){out.textContent=error.message;}finally{await context.close();button.disabled=false;}
});
