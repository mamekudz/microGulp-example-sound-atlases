// Atlas playback derived from microLib's shared-buffer/cue approach.
// Copyright (c) 1996-2026 Meinolf Amekudzi. MIT; see LICENSE.
export function ValidateAtlas(_atlas, _duration) {
 if (!_atlas || _atlas.schemaVersion !== 1 || !_atlas.sounds || typeof _atlas.sounds !== 'object' || Array.isArray(_atlas.sounds) || !Object.keys(_atlas.sounds).length) throw Error('ATLAS_SCHEMA');
 for (const cue of Object.values(_atlas.sounds)) {
  if (!Array.isArray(cue) || cue.length !== 4 || !cue.every(Number.isFinite)) throw Error('ATLAS_CUE');
  const [start, duration, loopStart, loopEnd] = cue;
  if (start < 0 || duration <= 0 || start + duration > _duration + 0.00001) throw Error('ATLAS_BOUNDS');
  if (!(loopStart === -1 && loopEnd === -1) && !(loopStart >= start && loopEnd > loopStart && loopEnd <= start + duration)) throw Error('ATLAS_LOOP');
 }
 return _atlas;
}

export class AtlasPlayer {
 constructor(_context, _fetch = (..._args) => globalThis.fetch(..._args)) {
  this.context = _context; this.fetch = _fetch; this.buffer = null; this.atlas = null;
  this.loopBuffers = new Map(); this.releasing = new WeakSet(); this.active = new Set(); this.generation = 0; this.disposed = false;
  this.master = _context.createGain(); this.master.gain.value = 0.2; this.master.connect(_context.destination);
  this.volume = 0.2; this.muted = false;
 }
 async Load(_jsonUrl, _audioUrl) {
  if (this.disposed) throw Error('PLAYER_DISPOSED');
  const generation = ++this.generation;
  this.controller?.abort(); this.controller = new AbortController();
  this.StopAll(true); this.loopBuffers.clear(); this.atlas = null; this.buffer = null;
  try {
   const responses = await Promise.all([_jsonUrl, _audioUrl].map(async (_url) => {
    const response = await this.fetch(_url, { signal: this.controller.signal });
    if (!response.ok) throw Error('HTTP_' + response.status);
    return response;
   }));
   const [atlas, bytes] = await Promise.all([responses[0].json(), responses[1].arrayBuffer()]);
   const buffer = await this.context.decodeAudioData(bytes);
   ValidateAtlas(atlas, buffer.duration);
   if (generation !== this.generation) throw Error('LOAD_SUPERSEDED');
   this.atlas = atlas; this.buffer = buffer;
   return Object.keys(atlas.sounds);
  } catch (_error) {
   if (generation !== this.generation) throw Error('LOAD_SUPERSEDED');
   this.controller.abort(); throw _error;
  }
 }
 async Enable() { if (this.disposed) throw Error('PLAYER_DISPOSED'); await this.context.resume(); if (this.context.state !== 'running') throw Error('AUDIO_SUSPENDED'); }
 SetVolume(_value) {
  if (!Number.isFinite(_value) || _value < 0 || _value > 1) throw Error('VOLUME_RANGE');
  this.volume = _value; this.master.gain.value = this.muted ? 0 : _value;
 }
 SetMuted(_value) { this.muted = Boolean(_value); this.SetVolume(this.volume); }
 Play(_name) {
  if (!this.buffer || !Object.hasOwn(this.atlas.sounds, _name)) throw Error('CUE_NOT_READY');
  if (this.context.state !== 'running') throw Error('AUDIO_SUSPENDED');
  const [start, duration, loopStart, loopEnd] = this.atlas.sounds[_name];
  const loop = loopStart >= 0;
  const source = this.context.createBufferSource(); source.connect(this.master);
  source.loop = loop;
  if (loop) {
   // Isolate the whole cue, including attack and release. Disabling loop must
   // never continue into the next sound in the shared atlas.
   if (!this.loopBuffers.has(_name)) {
    const rate = this.buffer.sampleRate, offset = Math.round(start * rate);
    const end = Math.min(this.buffer.length, Math.round((start + duration) * rate));
    const buffer = this.context.createBuffer(this.buffer.numberOfChannels, end - offset, rate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
     buffer.copyToChannel(this.buffer.getChannelData(channel).subarray(offset, end), channel);
    }
    this.loopBuffers.set(_name, buffer);
   }
   source.buffer = this.loopBuffers.get(_name);
   source.loopStart = loopStart - start; source.loopEnd = loopEnd - start;
  } else { source.buffer = this.buffer; }
  this.active.add(source);
  source.onended = () => { this.active.delete(source); source.disconnect(); };
  // A duration argument would terminate a loop. Start loop playback without it.
  try { if (loop) source.start(0, 0); else source.start(0, start, duration); }
  catch (_error) { this.active.delete(source); source.onended = null; source.disconnect(); throw _error; }
  return source;
 }
 Stop(_source, _force = false) {
  if (!this.active.has(_source)) return;
  if (!_force && (_source.loop || this.releasing.has(_source))) {
   _source.loop = false; this.releasing.add(_source); return;
  }
  this.active.delete(_source); _source.onended = null; _source.stop(); _source.disconnect();
 }
 StopAll(_force = false) { for (const source of [...this.active]) this.Stop(source, _force); }
 async Dispose() { this.disposed = true; ++this.generation; this.controller?.abort(); this.StopAll(true); this.loopBuffers.clear(); this.atlas = null; this.buffer = null; this.master.disconnect(); await this.context.close(); }
}
