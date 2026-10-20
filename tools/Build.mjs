import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import {CheckPackageVersions, GetVersionString, GetCurrentRelease} from './RecipeRelease.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function ValidateConfig(_config) {
 if (!_config || Object.keys(_config).sort().join() !== 'features,gapSeconds,sampleRate,volume') throw Error('CONFIG_KEYS');
 if (![24000,48000].includes(_config.sampleRate) || !Number.isFinite(_config.gapSeconds) || _config.gapSeconds < 0.02 || _config.gapSeconds > 1 || !Number.isFinite(_config.volume) || _config.volume < 0 || _config.volume > 1) throw Error('CONFIG_RANGE');
 if (!_config.features || Object.keys(_config.features).sort().join() !== 'failureTests,loops' || Object.values(_config.features).some(v=>typeof v !== 'boolean')) throw Error('CONFIG_FEATURES');
 return _config;
}
export function ParseSoundName(_filename, _frames) {
 const stem = path.basename(_filename, path.extname(_filename));
 const match = /^(.*)\.ls\.(\d+)\.le\.(\d+)$/.exec(stem);
 if (!match) {
  if (/\.(ls|le)\./.test(stem)) throw Error('FILENAME_LOOP');
  return {name:stem, loopStart:-1, loopEnd:-1};
 }
 const start = Number(match[2]), end = Number(match[3]);
 if (!match[1] || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > _frames) throw Error('FILENAME_LOOP');
 return {name:match[1], loopStart:start, loopEnd:end};
}
export function Wave(_samples, _rate) {
 const wav = Buffer.alloc(44+_samples.length*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(_rate,24);wav.writeUInt32LE(_rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(_samples.length*2,40);
 _samples.forEach((v,i)=>wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));
 return wav;
}
export async function WebA(_samples, _rate) {
 // FFmpeg writes the correct Opus codec delay and final discard padding.
 const result = spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','wav','-i','pipe:0','-c:a','libopus','-b:a','64k','-application','audio','-f','webm','pipe:1'],{input:Wave(_samples,_rate),maxBuffer:64*1024*1024,windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('WEBA_ENCODING: '+result.stderr.toString());
 return result.stdout;
}
export function Synthesize(_rate, _frequency, _duration, _attack=0.008, _release=0.015) {
 const length = Math.round(_rate*_duration);
 return Float32Array.from({length},(_,i)=>0.35*Math.min(1,i/(_rate*_attack),(length-1-i)/(_rate*_release))*Math.sin(2*Math.PI*_frequency*i/_rate));
}
export async function Build(_root = ROOT) {
 CheckPackageVersions(_root);
 const config = ValidateConfig(JSON.parse(await fs.readFile(path.join(_root,'config.json'),'utf8')));
 const rate = config.sampleRate, samples = [], sounds = {}, inputs = [];
 const output = path.join(_root,'public/generated'); await fs.mkdir(path.join(output,'sources'),{recursive:true});
 for (const [filename, pcm] of [
  ['confirm.wav',Synthesize(rate,660,0.18)], ['coin.wav',Synthesize(rate,990,0.12)],
  [`fly.ls.${Math.round(rate*0.1)}.le.${Math.round(rate*0.6)}.wav`,Synthesize(rate,220,0.8,0.1,0.2)]
 ]) {
  const cue = ParseSoundName(filename,pcm.length), start = samples.length/rate;
  inputs.push(filename); await fs.writeFile(path.join(output,'sources',filename),Wave(pcm,rate));
  samples.push(...pcm);
  sounds[cue.name]=[start,pcm.length/rate,cue.loopStart<0?-1:start+cue.loopStart/rate,cue.loopEnd<0?-1:start+cue.loopEnd/rate];
  for(let i=0;i<Math.round(config.gapSeconds*rate);i++)samples.push(0);
 }
 const wav = Wave(samples,rate), weba = await WebA(samples,rate), atlas = {schemaVersion:1,sounds};
 await fs.writeFile(path.join(output,'effects.wav'),wav);
 await fs.writeFile(path.join(output,'effects.weba'),weba);
 await fs.writeFile(path.join(output,'effects.json'),JSON.stringify(atlas,null,2));
 await fs.writeFile(path.join(output,'config.json'),JSON.stringify(config));
 await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({recipeVersion:GetVersionString(GetCurrentRelease(_root)),sampleRate:rate,frames:samples.length,inputs,sha256:createHash('sha256').update(wav).digest('hex'),webaSha256:createHash('sha256').update(weba).digest('hex'),encoder:'ffmpeg-static 5.2.0 / libopus; Opus 64 kbit/s mono',assets:'Synthetic tones, not the original FlyEx recordings.'},null,2));
 await fs.copyFile(path.join(_root,'src/AtlasPlayer.mjs'),path.join(output,'AtlasPlayer.mjs'));
 return {atlas,wav,weba,config};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify((await Build()).atlas));
