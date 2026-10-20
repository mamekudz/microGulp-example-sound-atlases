// ===========================================
// SoundAtlas.js
// © 1996-2026 Meinolf Amekudzi
// (published under MIT license)
// ===========================================

/** Module to manage sound playing.
 * @module Sounds
 */

import './WebUtils.mjs';
import Config from "./Config.mjs";

/** Static class to manage sound playing.
 * @class Sounds
 */
export default class Sounds {
	/** AudioContext constructor of the current browser (with webkit fallback). */
	static  _AUDIOCONTEXT = window.AudioContext || window.webkitAudioContext;
	/** Shared AudioContext instance used for all sound playback. */
	static AUDIOCONTEXT = new Sounds._AUDIOCONTEXT();
	/** Map of loaded sounds by name; each entry holds {buffer, info}. */
	static sounds = {};
	
	/** Map of registered load event callbacks by name, called after a sound atlas has been loaded. */
	static loadEvents = {};
	
	/** Returns the target element of an event in a browser-independent way.
	 * @param {Event} _e    Event to get the target element from.
	 * @returns {Element}    Target element of the event.
	 */
	static getEventTarget(_e) {
		let t;
		if (_e.target) {
			t = _e.target;
		} else if (_e.currentTarget) {
			t = _e.currentTarget;
		} else if (_e.srcElement) {
			t = _e.srcElement;
		}
		if (t.nodeType == 3) t = t.parentNode;
		return t;
	}
	
	/** Extracts a section of an audio buffer into a new AudioBuffer.
	 * @param {AudioBuffer} _srcAudioBuffer    Source audio buffer to extract from.
	 * @param {number} _start    Start position within the source buffer in seconds.
	 * @param {number} _duration    Duration of the section to extract in seconds.
	 * @returns {AudioBuffer}    New audio buffer containing the extracted section.
	 */
	static extractAudioBuffer(_srcAudioBuffer, _start, _duration) {
		let buffer = Sounds.AUDIOCONTEXT.createBuffer(_srcAudioBuffer.numberOfChannels, _srcAudioBuffer.sampleRate * _duration, _srcAudioBuffer.sampleRate);
		let srcChanData, dstChanData, s, c,
			offset = Math.floor(_start * _srcAudioBuffer.sampleRate);
		for (c = 0; c < _srcAudioBuffer.numberOfChannels; c++) {
			srcChanData = _srcAudioBuffer.getChannelData(c);
			dstChanData = buffer.getChannelData(c);
			for (s = 0; s < buffer.length; s++) dstChanData[s] = srcChanData[s + offset];
		}
		return buffer;
	}
	
	/** Internal handler called when a sound has ended; removes the listener and evaluates the sound's onendeval expression.
	 * @param {Event} _e    The "ended" event of the sound source.
	 */
	static _onSoundEnd(_e) {
		let s = Sounds.getEventTarget(_e);
		Sounds.sounds[s.name].removeEventListener("ended", _onSoundEnd, false);
		eval(Sounds.sounds[s.name].onendeval);
	}
	
	/** Plays a loaded sound by name with the given volume; loop sounds are started as endless loops.
	 * @param {string} _soundName    Name of the sound to play.
	 * @param {number} [_vol=100]    Playback volume (0 = muted, do not play).
	 * @returns {AudioBufferSourceNode|null}    Source node of the playing sound (can be passed to stop) or null if the sound was not played.
	 */
	static play(_soundName, _vol = 100) {
		let err, ret = null, i;
		//log("PlaySound=",_soundName);
		if (Sounds.sounds.hasOwnProperty(_soundName) && !document.hidden) {
			if (_vol == 0) return;
			let source = Sounds.AUDIOCONTEXT.createBufferSource();
			let gainNode = Sounds.AUDIOCONTEXT.createGain(),
				b = Sounds.sounds[_soundName].buffer, i = Sounds.sounds[_soundName].info;
			if (b == null) return;
			source.buffer = b;
			source.connect(gainNode);
			gainNode.connect(Sounds.AUDIOCONTEXT.destination);
			gainNode.gain.value = _vol;
			ret = source;
			source.isEnded = false;
			source.addEventListener('ended', function (e) { e.target.isEnded = true; });
			//source.onended=function(e){e.target.isEnded=true;};
			if (i == null) {
				source.start(0);
			} else {
				if (i[2] >= 0) {
					source.loop = true;
					source.loopStart = i[2];
					source.loopEnd = i[3];
					if (Config.IS_CHROME) {
						source.start(0, i[0], 10000);
					} else {
						source.start(0, i[0], i[1]);
					}
					;
				} else {
					source.start(0, i[0], i[1]);
				}
			}
		}
		return ret;
	}
	
	/** Plays a sound at the configured control volume, unless control sounds or all audio are muted.
	 * @param {string} _soundName    Name of the sound to play.
	 * @returns {AudioBufferSourceNode|null|undefined}    Source node of the playing sound, null if not played, or undefined if muted.
	 */
	static playControl(_soundName) {
		if (!Config.ALL_AUDIO_MUTE) if (!Config.SOUND_CONTROL_MUTE) return this.play(_soundName, Config.SOUND_CONTROL_VOL);
	}
	
	/** Plays a sound at the configured modal volume, unless modal sounds or all audio are muted.
	 * @param {string} _soundName    Name of the sound to play.
	 * @returns {AudioBufferSourceNode|null|undefined}    Source node of the playing sound, null if not played, or undefined if muted.
	 */
	static playModal(_soundName) {
		if (!Config.ALL_AUDIO_MUTE) if (!Config.SOUND_MODAL_MUTE) return this.play(_soundName, Config.SOUND_MODAL_VOL);
	}
	
	/** Stops a playing sound source; a loop sound finishes its current pass unless forced to stop immediately.
	 * @param {AudioBufferSourceNode} _source    Source node of the playing sound (as returned by play).
	 * @param {boolean} [_force=false]    If true, a loop sound is stopped immediately instead of finishing its current pass.
	 * @returns {AudioBufferSourceNode|null|undefined}    The still playing source node (loop finishing), null if stopped, or undefined if _source was null.
	 */
	static stop(_source, _force = false) {
		if (_source != null) {
			if (_source.loop && !_force) {
				_source.loop = false;
				return _source;
			} else {
				_source.stop();
				_source.isEnded = true;
				return null;
			}
		}
	}
	
	/** Loads a sound file or a sound atlas (audio file plus JSON description of named sections) and registers its sounds; loop sections are extracted into separate buffers.
	 * @param {string} _soundAtlasName    File name of the sound or sound atlas; a ".json" suffix loads the atlas description alongside the audio data.
	 * @param {string} [_path=null]    Path to the sound files (null = "./build/exresources/snds").
	 */
	static load(_soundAtlasName, _path = null) {
		if (_path === null) _path = "./build/exresources/snds";
		if (Sounds.sounds[_soundAtlasName] === undefined) {
			let request = new XMLHttpRequest(), isjson = true;
			if (_soundAtlasName.suffix() == "json") {
				WebUtils.LoadJSON(_path + '/' + _soundAtlasName, false, {sndName: _soundAtlasName}, function (_json, _success, _info) {
					let s, sndName = _info.sndName.withoutSuffix();
					if (Sounds.sounds.hasOwnProperty(sndName)) {
						for (s in _json.sounds) Sounds.sounds[s] = {
							buffer: Sounds.sounds[sndName].buffer,
							info: _json.sounds[s]
						};
						delete Sounds.sounds[sndName];
					} else {
						for (s in _json.sounds) Sounds.sounds[s] = {
							buffer: null,
							info: _json.sounds[s]
						};
						Sounds.sounds[sndName] = {
							buffer: null,
							info: null,
							jsonsounds: _json.sounds
						};
					}
				})
				_soundAtlasName = _soundAtlasName.withoutSuffix();
			} else {
				isjson = false;
			}
			request.open("GET", _path + '/' + _soundAtlasName, true);
			if (!isjson) _soundAtlasName = _soundAtlasName.withoutSuffix();
			request.responseType = "arraybuffer";
			request.onload = function () {
				// Asynchronously decode the audio file data in request.response
				//log(_soundAtlasName);
				Sounds.AUDIOCONTEXT.decodeAudioData(
					request.response,
					function (buffer) {
						let sndName = _soundAtlasName, s;
						if (buffer) {
							if (Sounds.sounds.hasOwnProperty(sndName)) {
								for (s in Sounds.sounds[sndName].jsonsounds) {
									Sounds.sounds[s] = {
										buffer: buffer,
										info: Sounds.sounds[sndName].jsonsounds[s]
									};
									if (Sounds.sounds[s].info[2] >= 0) {
										// is a loop sound, because w3c has a silly definition for loops we have to create a new buffer...
										let newbuffer = Sounds.extractAudioBuffer(buffer, Sounds.sounds[s].info[0], Sounds.sounds[s].info[1]);
										Sounds.sounds[s].buffer = newbuffer;
										Sounds.sounds[s].info[2] -= Sounds.sounds[s].info[0];
										Sounds.sounds[s].info[3] -= Sounds.sounds[s].info[0];
										Sounds.sounds[s].info[0] = 0;
										//sounds[s].info[SND_DURATION]=0;
									}
								}
								delete Sounds.sounds[sndName];
							} else {
								Sounds.sounds[sndName] = {buffer: buffer, info: null};
							}
						}
						for(let se in Sounds.loadEvents){
							Sounds.loadEvents[se]();
						}
						//if (µlibConf.hasOwnProperty("soundPlayOnLoad")) if (sounds.hasOwnProperty(µlibConf.soundPlayOnLoad)) if (!GetParameterExists("noss")) PlaySound(µlibConf.soundPlayOnLoad);
					},
					function (error) {
						console.Log("Error loading sound:", _soundAtlasName);
					}
				)
			}
			request.send();
		}
	}
	
	/** Registers a callback function that is called whenever a sound atlas has finished loading.
	 * @param {string} _name    Unique name of the load event callback.
	 * @param {function} _eventFunction    Callback function to call after loading.
	 */
	static registerLoadEvent(_name, _eventFunction) {
		Sounds.loadEvents [_name] = _eventFunction;
	}
	
	/** Removes a previously registered load event callback.
	 * @param {string} _name    Name of the load event callback to remove.
	 */
	static unRegisterLoadEvent(_name) {
		delete Sounds.loadEvents [_name];
	}
	
}