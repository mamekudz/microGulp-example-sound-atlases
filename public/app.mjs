import {AtlasPlayer} from './generated/AtlasPlayer.mjs';
import {Trans} from './vendor/i18x-engine.mjs';
const $ = _id => document.getElementById(_id);
const Text = (_source, _values={}) => Trans(_source,_values,{lid:'en-US',formats:{},timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
let player, config, loaded=false, enabled=false, loopSource=null, sequence=0;
function Status(_text,_error=false) { $('status').textContent=_text;$('status').dataset.error=String(_error); }
function Update() { for(const id of ['confirm','coin','loop'])$(id).disabled=!loaded||!enabled; $('loop').hidden=!config?.features.loops; $('activity').textContent=Text('Active voices: <count/><context="audio demo"/>',{count:player?.active.size??0}); }
async function Load(_failure='') {
 const sequenceId=++sequence;loaded=false;loopSource=null;$('flight').classList.remove('flying');Update();Status(Text('Loading atlas…<context="audio demo"/>'));
 let json='/generated/effects.json',audio='/generated/effects.'+$('format').value;
 if(_failure==='missing-json')json='/test/missing.json';
 if(_failure==='missing-audio')audio='/test/missing.wav';
 if(['bad-json','bad-loop'].includes(_failure))json='/test/'+_failure;
 if(_failure==='bad-audio')audio='/test/bad-audio';
 try { const names=await player.Load(json,audio);if(sequenceId!==sequence)return;loaded=true;
  $('cues').replaceChildren(...names.map(_name=>{const el=document.createElement('span');el.textContent=_name;return el;}));
  Status(Text('Atlas ready: <count/> sounds.<context="audio demo"/>',{count:names.length}));
 }catch(_error){if(sequenceId!==sequence)return;Status(Text('Load failed: <reason/>. Use Load atlas to recover.<context="audio demo"/>',{reason:_error.message}),true);$('cues').replaceChildren();}
 Update();
}
try {
 const response=await fetch('/generated/config.json');if(!response.ok)throw Error('CONFIG_HTTP');config=await response.json();
 const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error('WEB_AUDIO_UNAVAILABLE');
 player=new AtlasPlayer(new AudioContext());player.SetVolume(config.volume);$('volume').value=config.volume;
 $('failure-section').hidden=!config.features.failureTests;
 $('enable').addEventListener('click',async()=>{try{await player.Enable();enabled=true;Status(Text('Audio enabled.<context="audio demo"/>'));}catch(_error){Status(_error.message,true);}Update();});
 $('load').addEventListener('click',()=>Load());
 for(const name of ['confirm','coin'])$(name).addEventListener('click',()=>{try{player.Play(name);Status(Text('Playing <name/>.<context="audio demo"/>',{name}));}catch(_error){Status(_error.message,true);}Update();});
 $('loop').addEventListener('click',()=>{try{if(loopSource)player.Stop(loopSource,true);loopSource=player.Play('fly');$('flight').classList.add('flying');Status(Text('Flying: attack, then loop. Use Land to hear the release.<context="audio demo"/>'));}catch(_error){Status(_error.message,true);}Update();});
 $('land').addEventListener('click',()=>{player.Stop(loopSource);$('flight').classList.remove('flying');Status(Text('Landing: finish the current pass and release.<context="audio demo"/>'));Update();});
 $('stop').addEventListener('click',()=>{player.StopAll(true);loopSource=null;$('flight').classList.remove('flying');Status(Text('All sounds stopped.<context="audio demo"/>'));Update();});
 $('mute').addEventListener('change',()=>player.SetMuted($('mute').checked));
 $('volume').addEventListener('input',()=>player.SetVolume(Number($('volume').value)));
 document.querySelectorAll('[data-failure]').forEach(_button=>_button.addEventListener('click',()=>Load(_button.dataset.failure)));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){player.StopAll(true);loopSource=null;$('flight').classList.remove('flying');Status(Text('Playback stopped while hidden.<context="audio demo"/>'));Update();}});
 window.addEventListener('pagehide',()=>{clearInterval(timer);void player.Dispose();});
 const timer=setInterval(Update,150);
 await Load();
}catch(_error){Status(Text('Initialization failed: <reason/><context="audio demo"/>',{reason:_error.message}),true);$('enable').disabled=true;$('load').disabled=true;document.querySelectorAll('[data-failure]').forEach(_button=>_button.disabled=true);}
