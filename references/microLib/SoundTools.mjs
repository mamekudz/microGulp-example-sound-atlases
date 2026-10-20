//	===============================================
//	soundtools.js
// © 1996-2026 Meinolf Amekudzi
// (published under MIT license)
// ===========================================


//	===============================================
//	Sound Generation Functions
//	===============================================
 
/** Sound generation and processing tools: loading wave and MP3 sounds,
 * converting sample formats, and building combined sound atlases with timing metadata.
 * @module SoundTools
 */

/** Utility class for loading, converting, and combining wave sounds into sound atlases.
 * @class SoundTools
 */
function SoundTools(){
};
/** Running counter used to assign unique values to the event constants below. */
ENUMERATION=1;
/** Event constant: no event occurred yet. */
SoundTools.EVENT_NONE=SoundTools.prototype.EVENT_NONE=ENUMERATION++;
/** Event constant: a general error occurred (negative value). */
SoundTools.EVENT_ERROR_GENERAL=SoundTools.prototype.EVENT_ERROR_GENERAL=0-ENUMERATION++;
/** Event constant: a single sound failed to load (negative value). */
SoundTools.EVENT_ERROR_SOUNDLOAD=SoundTools.prototype.EVENT_ERROR_SOUNDLOAD=0-ENUMERATION++;
/** Event constant: the sound set failed to load (negative value). */
SoundTools.EVENT_ERROR_SOUNDSLOAD=SoundTools.prototype.EVENT_ERROR_SOUNDSLOAD=0-ENUMERATION++;
/** Event constant: ready, but there were no sounds to load. */
SoundTools.EVENT_READYNOSOUNDSTOLOAD=SoundTools.prototype.EVENT_READYNOSOUNDSTOLOAD=ENUMERATION++;
/** Event constant: processing is in progress. */
SoundTools.EVENT_PROCESS=SoundTools.prototype.EVENT_PROCESS=ENUMERATION++;
/** Event constant: a single sound finished loading. */
SoundTools.EVENT_SOUNDLOADED=SoundTools.prototype.EVENT_SOUNDLOADED=ENUMERATION++;
/** Event constant: all sounds finished loading. */
SoundTools.EVENT_SOUNDSLOADED=SoundTools.prototype.EVENT_SOUNDSLOADED=ENUMERATION++;
/** Event constant: a scan operation started. */
SoundTools.EVENT_SCANSTART=SoundTools.prototype.EVENT_SCANSTART=ENUMERATION++;
/** Event constant: duplicate sounds are being reduced. */
SoundTools.EVENT_REDUCEDUPLICATES=SoundTools.prototype.EVENT_REDUCEDUPLICATES=ENUMERATION++;
/** Event constant: processing finished, the result is available. */
SoundTools.EVENT_READY=SoundTools.prototype.EVENT_READY=ENUMERATION++;

/** Conversion mode: use the lowest sample rate found among all sounds. */
SoundTools.CNV_SAMPLERATE_LOWEST=-1;
/** Conversion mode: use the highest sample rate found among all sounds. */
SoundTools.CNV_SAMPLERATE_HIGHEST=0;
/** Conversion mode: use the lowest sample size found among all sounds. */
SoundTools.CNV_SAMPLESIZE_LOWEST=-1;
/** Conversion mode: use the highest sample size found among all sounds. */
SoundTools.CNV_SAMPLESIZE_HIGHEST=0;
/** Conversion mode: use the lowest number of channels found among all sounds. */
SoundTools.CNV_NOOFCHANNELS_LOWEST=-1;
/** Conversion mode: use the highest number of channels found among all sounds. */
SoundTools.CNV_NOOFCHANNELS_HIGHEST=0;
/** Stereo handling mode: keep stereo channels as they are. */
SoundTools.CNV_STEREO_KEEP=0;
/** Stereo handling mode: split stereo into separate left/right sounds. */
SoundTools.CNV_STEREO_SPLIT=1;
/** Stereo handling mode: mix stereo down to mono. */
SoundTools.CNV_STEREO_MONO=2;

/** Index of the original sample rate in a sound origin info array. */
SoundTools.ORG_SAMPLERATE=0;
/** Index of the original sample size in a sound origin info array. */
SoundTools.ORG_SAMPLESIZE=1;
/** Index of the start sample (within the atlas) in a sound origin info array. */
SoundTools.ORG_STARTSAMPLE=2;
/** Index of the end sample (within the atlas) in a sound origin info array. */
SoundTools.ORG_ENDSAMPLE=3;
/** Index of the number of samples in a sound origin info array. */
SoundTools.ORG_NOOFSAMPLES=4;
/** Index of the loop start sample in a sound origin info array. */
SoundTools.ORG_STARTLOOPSAMPLE=5;
/** Index of the loop end sample in a sound origin info array. */
SoundTools.ORG_ENDLOOPSAMPLE=6;

/** Index of the start time (seconds) in a sound atlas entry. */
const SND_STARTTIME=0;
/** Index of the duration (seconds) in a sound atlas entry. */
const SND_DURATION=1;
/** Index of the loop start time (seconds) in a sound atlas entry. */
const SND_LOOPSTARTTIME=2;
/** Index of the loop end time (seconds) in a sound atlas entry. */
const SND_LOOPENDTIME=3;
/** Index of the buffer number in a sound atlas entry. */
const SND_BUFFERNO=4;

/** Last event type reported by this instance (one of the EVENT_* constants). */
SoundTools.prototype.eventType=SoundTools.EVENT_NONE;


/** In-memory PCM wave sound with WAV (RIFF) header handling, MP3 decoding, and
 * format conversion. Loop points can be encoded in the name as "name.ls.100.le.200".
 * @class WaveSound
 * @param {string} _name Sound name; an optional ".ls.[start].le.[end]" suffix defines loop start/end samples.
 * @param {(Uint8Array|ArrayBuffer|AudioBuffer|number|null)} _dataOrLength WAV/MP3 byte data, an AudioBuffer to copy, a byte length to allocate, or null for an empty 44-byte header (default null).
 * @param {boolean} _onlyLoadMP3 If true, MP3 data is only decoded to an AudioBuffer and not converted to PCM data (default false).
 * @param {?function} _callBack Called as _callBack(waveSound, valid) when construction/decoding has finished (default null).
 */
function WaveSound(_name,_dataOrLength=null,_onlyLoadMP3=false,_callBack=null){
var doCallBack=true,l,np;
	//if(_name.indexOf("pinch")>=0){
	//	_name=_name;
	//};
	this.loopStart=-1;
	this.loopEnd=-1;
	this.valid=false;
	this.equalTo=-1;
	np=_name.split(".");
	// testsound.ls.100.le.200
	if(np.length>=5){
		l=np.length;
		if(np[l-2]=="le"&&np[l-4]=="ls"){
			this.loopStart=parseInt(np[l-3],10);
			this.loopEnd=parseInt(np[l-1],10);
			np.length=l-4;
			_name=np.join(".");
		};
	};
	this.name=_name;
	this.sampleRate=-1;
	this.sampleSize=-1;
	this.noOfSamples=-1;
	this.noOfChannels=-1;
	this.bitRate=128;
	this.dataOffset=44;
	this.onload=NOFUNCTION;
	this.onerror=NOFUNCTION;
	if(_dataOrLength==null){
		this.data=new Uint8Array(44);
	}else if(_dataOrLength.constructor==AudioBuffer){
		this.CreateNew(_dataOrLength.sampleRate,_dataOrLength.hasOwnProperty("sampleSize")?dataOrLength.sampleSize:16,_dataOrLength.length,_dataOrLength.numberOfChannels);
		var td=this.data,d,dd,d1,dd1,i,l=this.noOfSamples,doff=this.dataOffset;
		d=_dataOrLength.getChannelData(0);
		if(this.noOfChannels==1){
			if(this.sampleSize==16){
				for(i=0;i<l;i++){
					dd=Math.round(d[i]*32767);
					td[2*i+doff]=dd&0xFF;
					td[2*i+doff+1]=(dd&0xFF00)>>8;
				};
			}else{
				for(i=0;i<l;i++){
					dd=Math.round(d[i]*255);
					td[i+doff]=dd&0xFF;
				};
			};
		}else{
			d1=_audiobuffer.getChannelData(1);
			if(this.sampleSize==16){
				for(i=0;i<self.noOfSamples;i++){
					dd=Math.round(d[i]*32767);
					dd1=Math.round(d1[i]*32767);
					td[4*i+doff]=dd&0xFF;
					td[4*i+doff+1]=(dd&0xFF00)>>8;
					td[4*i+doff+2]=dd1&0xFF;
					td[4*i+doff+3]=(dd1&0xFF00)>>8;
				};
			}else{
				for(i=0;i<self.noOfSamples;i++){
					dd=Math.round(d[i]*255);
					dd1=Math.round(d1[i]*255);
					td[2*i+doff]=dd&0xFF;
					td[2*i+doff+1]=dd1&0xFF;
				};
			};
		};
	}else if(typeof(_dataOrLength)=="number"){
		this.data=new Uint8Array(_dataOrLength);
	}else{
		this.data=new Uint8Array(_dataOrLength);
		this.GetAudioFormat();
		if(!this.valid&&(this.data[0]==0x49&&this.data[1]==0x44&&this.data[2]==0x33)||(this.data[0]==0xff&&this.data[1]==0xfb&&this.data[2]==0xe0)){
			doCallBack=false;
			this.SetMP3Data(_dataOrLength,_onlyLoadMP3,_callBack);
		};
	};
	if(_callBack!==null&&doCallBack)_callBack(this,this.valid);
};

/** Parses the first MP3 frame header (channels, bit rate, sample rate) and decodes
 * the MP3 data into this wave sound's PCM data via the Web Audio API.
 * @param {ArrayBuffer} _arrayBuffer MP3 file data to decode.
 * @param {boolean} _onlyLoadMP3 If true, only stores the decoded AudioBuffer without PCM conversion (default false).
 * @param {?function} _callBack Called as _callBack(waveSound, valid) when decoding has finished (default null).
 */
WaveSound.prototype.SetMP3Data=function(_arrayBuffer,_onlyLoadMP3=false,_callBack=null){
var self=this,source=AUDIOCONTEXT.createBufferSource();
var mpgSampFreqs=[[11025,12000,8000,0],[0,0,0,0],[22050,24000,16000,0],[44100,48000,32000,0]];
var BitRates=[[0,0,0,0,0],
							[32,32,32,32,8],
							[64,48,40,48,16],
							[96,56,48,56,24],
							[128,64,56,64,32],
							[160,80,64,80,40],
							[192,96,80,96,48],
							[224,112,96,112,56],
							[256,128,112,128,64],
							[288,160,128,144,80],
							[320,192,160,160,96],
							[352,224,192,176,112],
							[384,256,224,192,128],
							[416,320,256,224,144],
							[448,384,320,256,160],
							[0,0,0,0,0]
						];
// find first frame...
var i=3,data=self.data,l=self.data.length,ok=false;
	while(i<l&&!ok){i++;ok=(data[i]==0xff&&((data[i+1]>>5)&0x7)==0x7&&((data[i+1]>>1)&0x3)!=0&&((data[i+2]>>4)&0xf)!=0xf&&((data[i+2]>>2)&0x3)!=0x3);};
	if(i>=l){
		if(_callBack!=null)_callBack(self,self.valid);
		return;
	};
var mpgChannel=(data[i+3]&0xC0)>>6,mpgChannels=mpgChannel<3?2:1,mpgId=(data[i+1]&0x18)>>3,mpgBitrateValue=(data[i+2]&0xF0)>>4,mpgSampleFreqValue=(data[i+2]&0x0C)>>2,mpgSampleRate=mpgSampFreqs[mpgId][mpgSampleFreqValue];
var mpgLayer=(data[i+1]&0x06)>>1,mpgBitRate=0,mpgLayerValue;
	switch(mpgId){
		case 3:
			switch(mpgLayer){
				case 0:mpgLayerValue=0;break;
				case 1:mpgLayerValue=2;break;
				case 2:mpgLayerValue=1;break;
				case 3:mpgLayerValue=0;break;
			};
			break;
		default:
			switch(mpgLayer){
				case 0:mpgLayerValue=4;break;
				case 1:mpgLayerValue=4;break;
				case 2:mpgLayerValue=4;break;
				case 3:mpgLayerValue=3;break;
			};
	};
	mpgBitRate=BitRates[mpgBitrateValue][mpgLayerValue];
	if(mpgSampleRate==0||mpgId==1||mpgLayer==0){
		if(_callBack!=null)_callBack(self,self.valid);
		return;
	};
	//log(self.name,mpgChannels,mpgBitRate,mpgSampleRate);
	//log(_arrayBuffer);
	var oldArrayBuffer=_arrayBuffer.slice(0);
	AUDIOCONTEXT.decodeAudioData(_arrayBuffer,
		function(_audiobuffer){
			self.bitRate=mpgBitRate;
			self.noOfChannels=_audiobuffer.numberOfChannels;
			self.sampleSize=16;
			self.sampleRate=mpgSampleRate;
			self.noOfSamples=Math.round(_audiobuffer.length*self.sampleRate/_audiobuffer.sampleRate);
			if(_onlyLoadMP3){
				self.audiobuffer=_audiobuffer;
				self.valid=true;
				data=null; // release the raw MP3 bytes ("delete data" is illegal in strict-mode ESM)
				if(_callBack!=null)_callBack(self,self.valid);
				return;
			};
			var OFFLINEAUDIOCONTEXT=new OfflineAudioContext(self.noOfChannels,self.noOfSamples,self.sampleRate);
			OFFLINEAUDIOCONTEXT.decodeAudioData(oldArrayBuffer,
				function(_audiobuffer){
				var d,dd,d1,dd1,i;
					self.valid=true;
					self.CreateNew(self.sampleRate,self.sampleSize,self.noOfSamples,self.noOfChannels);
					if(self.noOfChannels==1){
						d=_audiobuffer.getChannelData(0);
						for(i=0;i<self.noOfSamples;i++){
							dd=Math.round(d[i]*32767);
							self.data[2*i+self.dataOffset]=dd&0xFF;
							self.data[2*i+self.dataOffset+1]=(dd&0xFF00)>>8;
						};
					}else{
						d=_audiobuffer.getChannelData(0);
						d1=_audiobuffer.getChannelData(1);
						for(i=0;i<self.noOfSamples;i++){
							dd=Math.round(d[i]*32767);
							dd1=Math.round(d1[i]*32767);
							self.data[4*i+self.dataOffset]=dd&0xFF;
							self.data[4*i+self.dataOffset+1]=(dd&0xFF00)>>8;
							self.data[4*i+self.dataOffset+2]=dd1&0xFF;
							self.data[4*i+self.dataOffset+3]=(dd1&0xFF00)>>8;
						};
					};
					if(_callBack!=null)_callBack(self,self.valid);
				},
				function(_error){
					if(_callBack!==null)_callBack(self,self.valid);
				}
			)
		},
		function(_error){
			if(_callBack!==null)_callBack(self,self.valid);
		}
	);
};

/** Parses the WAV (RIFF/PCM) header in this.data and fills in sample rate, sample size,
 * number of channels, number of samples, and data offset; sets this.valid accordingly.
 */
WaveSound.prototype.GetAudioFormat=function(){
var d=this.data;
	if(d.length<=46){
		this.valid=false;
	}else{
		// check RIFF tag...
		if(d[0]!=0x52||d[1]!=0x49||d[2]!=0x46||d[3]!=0x46){
			this.valid=false;
		}else{
			// check WAVE tag...
			if(d[8]!=0x57||d[9]!=0x41||d[10]!=0x56||d[11]!=0x45){
				this.valid=false;
			}else{
				// check fmt tag...
				if(d[12]!=0x66||d[13]!=0x6D||d[14]!=0x74||d[15]!=0x20){
					this.valid=false;
				}else{
					this.dataOffset=28+d[16]+d[17]*256;
					// check PCM format?...
					if(d[20]!=0x01||d[21]!=0x00){
						this.valid=false;
					}else{
						// check data header...
						if(d[this.dataOffset-8]!=0x64||d[this.dataOffset+1-8]!=0x61||d[this.dataOffset+2-8]!=0x74||d[this.dataOffset+3-8]!=0x61){
							this.valid=false;
						}else{
							this.sampleSize=d[34]+d[35]*256;
							if(this.sampleSize!=8&&this.sampleSize!=16){
								this.valid=false;
							}else{
								this.noOfChannels=d[22]+d[23]*256;
								this.sampleRate=(d[24]+d[25]*256+d[26]*65536+d[27]*16777216);
								var dof=this.dataOffset;
								var datalen=(d[dof-4]+d[dof-3]*256+d[dof-2]*65536+d[dof-1]*16777216);
								//this.noOfSamples=Math.floor((datalen-this.dataOffset)/(this.noOfChannels*this.sampleSize/8));
								this.noOfSamples=Math.floor((datalen)/(this.noOfChannels*this.sampleSize/8));
								this.valid=true;
							};
						};
					};
				};
			};
		};
	};
};
/** Returns the mono sample data as 16-bit integers (8-bit samples are scaled up).
 * @returns {Int16Array} Mono sample data.
 */
WaveSound.prototype.MonoIntData=function(){
var ret=new Int16Array(this.noOfSamples),i,l=this.noOfSamples,o=this.dataOffset,data=this.data;
	if(this.sampleSize==8){
		for(i=0;i<l;i++)ret[i]=data[o+i]*256;
	}else{
		for(i=0;i<l;i++)ret[i]=data[o+i*2]+data[o+i*2+1]*256;
	};
	return ret;
};
/** Returns the left channel sample data as 16-bit integers (8-bit samples are scaled up).
 * @returns {Int16Array} Left channel sample data.
 */
WaveSound.prototype.LeftIntData=function(){
var ret=new Int16Array(this.noOfSamples),i,l=this.noOfSamples,o=this.dataOffset,data=this.data;
	if(this.sampleSize==8){
		for(i=0;i<l;i++)ret[i]=data[o+i*2]*256;
	}else{
		for(i=0;i<l;i++)ret[i]=data[o+i*4]+data[o+i*4+1]*256;
	};
	return ret;
};
/** Returns the right channel sample data as 16-bit integers (8-bit samples are scaled up).
 * @returns {Int16Array} Right channel sample data.
 */
WaveSound.prototype.RightIntData=function(){
var ret=new Int16Array(this.noOfSamples),i,l=this.noOfSamples,o=this.dataOffset,data=this.data;
	if(this.sampleSize==8){
		for(i=0;i<l;i++)ret[i]=data[o+i*2+1]*256;
	}else{
		for(i=0;i<l;i++)ret[i]=data[o+i*4+2]+data[o+i*4+3]*256;
	};
	return ret;
};
/** Allocates a new data buffer and writes a complete WAV (RIFF/PCM) header for the given format.
 * @param {number} _sampleRate Sample rate in Hz.
 * @param {number} _sampleSize Sample size in bits (8 or 16).
 * @param {number} _noOfSamples Number of samples per channel.
 * @param {number} _noOfChannels Number of channels (default 1).
 */
WaveSound.prototype.CreateNew=function(_sampleRate,_sampleSize,_noOfSamples,_noOfChannels){
if(_noOfChannels===undefined)_noOfChannels=1;
var d,bytesPerSecond=_sampleRate*_sampleSize/8*_noOfChannels,flen,len=_noOfSamples*_sampleSize/8*_noOfChannels;
	this.valid=true;
	this.sampleRate=_sampleRate;
	this.sampleSize=_sampleSize;
	this.noOfSamples=_noOfSamples;
	this.noOfChannels=_noOfChannels;
	this.dataOffset=44;
	d=this.data=new Uint8Array(len+this.dataOffset);
	//RIFF
	d[0]=0x52;
	d[1]=0x49;
	d[2]=0x46;
	d[3]=0x46;
	flen=len+36;
	d[4]=(flen&0x000000FF);
	d[5]=(flen&0x0000FF00)>>8;
	d[6]=(flen&0x00FF0000)>>16;
	d[7]=(flen&0xFF000000)>>24;
	//WAVE
	d[8]=0x57;
	d[9]=0x41;
	d[10]=0x56;
	d[11]=0x45;
	//fmt
	d[12]=0x66;
	d[13]=0x6D;
	d[14]=0x74;
	d[15]=0x20;
	//fmt length
	d[16]=0x10;
	d[17]=0x00;
	d[18]=0x00;
	d[19]=0x00;
	//fmt tag (PCM)
	d[20]=0x01;
	d[21]=0x00;
	//channels
	d[22]=(_noOfChannels&0xFF);
	d[23]=0x00;
	//samplerate
	d[24]=(_sampleRate&0x000000FF);
	d[25]=(_sampleRate&0x0000FF00)>>8;
	d[26]=(_sampleRate&0x00FF0000)>>16;
	d[27]=(_sampleRate&0xFF000000)>>24;
	//bytes/second
	d[28]=(bytesPerSecond&0x000000FF);
	d[29]=(bytesPerSecond&0x0000FF00)>>8;
	d[30]=(bytesPerSecond&0x00FF0000)>>16;
	d[31]=(bytesPerSecond&0xFF000000)>>24;
	//block align
	d[32]=((_sampleSize/8*_noOfChannels)&0x000000FF);
	d[33]=0x00;
	//bits/sample
	d[34]=_sampleSize&0xFF;
	d[35]=0x00;
	//data header
	d[36]=0x64;
	d[37]=0x61;
	d[38]=0x74;
	d[39]=0x61;
	//dblock length
	flen=len;
	d[40]=flen&0x000000FF;
	d[40]=flen&0x0000FF00>>8;
	d[42]=flen&0x00FF0000>>16;
	d[43]=flen&0xFF000000>>24;
};
/** Compares this wave sound with another one for identical format and sample data.
 * @param {WaveSound} _cmpToWave Wave sound to compare with.
 * @returns {boolean} True if format and data are identical, false otherwise.
 */
WaveSound.prototype.Compare=function(_cmpToWave){
var i,l,d1=this.data,d2=_cmpToWave.data;
	if(this.sampleRate==_cmpToWave.sampleRate&&this.sampleSize==_cmpToWave.sampleSize&&this.noOfSamples==_cmpToWave.noOfSamples&&this.noOfChannels==_cmpToWave.noOfChannels){
		l=d1.length;
		for(i=0;i<l;i++)if(d1[i]!=d2[i])return false;
		return true;
	}else{
		return false;
	};
};
/** Copies the sample data of another wave sound into this one starting at the given sample position.
 * @param {number} _sampleWritePointer Sample position to start writing at.
 * @param {WaveSound} _waveSoundToReadFrom Wave sound whose sample data is copied.
 * @returns {number} Sample position right after the copied data.
 */
WaveSound.prototype.Overwrite=function(_sampleWritePointer,_waveSoundToReadFrom){
var wdata=this.data,ws=_sampleWritePointer*this.noOfChannels*this.sampleSize/8+this.dataOffset,r=_waveSoundToReadFrom;
var rdata=r.data,rss=r.dataOffset,rse=rss+r.noOfSamples*(r.sampleSize/8)*r.noOfChannels,s;
	//log(this.name,this.noOfSamples);
	//log(_waveSoundToReadFrom.name,_waveSoundToReadFrom.noOfSamples,rse);
	//rse=rse-60;
	for(s=rss;s<rse;s++)wdata[ws++]=rdata[s];
	return (ws-this.dataOffset)/this.noOfChannels/(this.sampleSize/8);
};
/** Fills the whole sample data area with silence (zero line). */
WaveSound.prototype.SetZeroLine=function(){
var wdata=this.data,wss=this.dataOffset,wse=wss+this.noOfSamples*this.sampleSize/8*this.noOfChannels,s;
	if(this.sampleSize==8){
		for(s=wss;s<wse;s++)wdata[s]=0x80;
	}else{
		for(s=wss;s<wse;s+=2){wdata[s]=0x00;wdata[s+1]=0x00;};
	};
};
/** Returns the wave sound as a base64-encoded WAV data URL.
 * @returns {string} Data URL containing the WAV data.
 */
WaveSound.prototype.ToWaveDataURL =function(){
	return "data:audio/wav;base64,"+base64ArrayBuffer(this.data);
};
/** Encodes the wave sound to MP3 (via lamejs) and passes the result as a data URL to the callback.
 * @param {function} _callBack Called with the base64-encoded MP3 data URL.
 */
WaveSound.prototype.ToMP3DataURL =function(_callBack){
	function _blob2Base64(_blob,_callBack) {
		var reader=new FileReader();
		reader.onload=function(){_callBack(reader.result);};
		reader.readAsDataURL(_blob);
	};
	function _lameEncode(_l,_r,_sampleRate,_bitRate){
	var mp3Encoder=new lamejs.Mp3Encoder(_r==null?1:2,_sampleRate,_bitRate);
	var blockSize=1152,blocks=[],mp3Buffer,length=_l.length,i,lc,rc;
		for(i=0;i<length;i+=blockSize) {
				//progress((i/length)*100);
				lc=_l.subarray(i,i+blockSize);
				if(_r!=null){
					rc=_r.subarray(i,i+blockSize);
					mp3Buffer=mp3Encoder.encodeBuffer(lc,rc);
				}else{
					mp3Buffer=mp3Encoder.encodeBuffer(lc);
				};
				if(mp3Buffer.length>0)blocks.push(mp3Buffer);
		};
		mp3Buffer=mp3Encoder.flush();   
		if(mp3Buffer.length>0) blocks.push(mp3Buffer);
		//progress(100);
		return new Blob(blocks,{type:'audio/mpeg'});
	};
	if(this.noOfChannels==1){
		_blob2Base64(_lameEncode(this.MonoIntData(),null,this.sampleRate,this.bitRate),_callBack);
	}else{
		_blob2Base64(_lameEncode(this.LeftIntData(),this.RightIntData(),this.sampleRate,this.bitRate),_callBack);
	};
};

/** Splits a stereo wave sound into two mono wave sounds.
 * @returns {WaveSound[]} Array with the left channel sound at index 0 and the right channel sound at index 1.
 */
WaveSound.prototype.SeparateStereo=function(){
var rdata=this.data,rss=this.dataOffset,rse=rss+this.noOfSamples*this.sampleSize/8*2,s,ws=44,sampleStep=this.sampleSize/8;
var wl,wr,wldata,wrdata;
	wl=new WaveSound(this.name+"_l");
	wl.CreateNew(this.sampleRate,this.sampleSize,this.noOfSamples);
	wldata=wl.data;
	wr=new WaveSound(this.name+"_r");
	wr.CreateNew(this.sampleRate,this.sampleSize,this.noOfSamples);
	wrdata=wr.data;
	
	if(this.sampleSize==8){
		// 8
		for(s=rss;s<rse;s+=sampleStep*2){
			wldata[ws]=rdata[s];
			wrdata[ws]=rdata[s+1];
			ws++;
		};
	}else{
		// 16
		for(s=rss;s<rse;s+=sampleStep*2){
			wldata[ws]=rdata[s];
			wldata[ws+1]=rdata[s+1];
			wrdata[ws]=rdata[s+2];
			wrdata[ws+1]=rdata[s+3];
			ws+=2;
		};
	};
	return [wl,wr];
};
/** Converts the wave sound in place to the given sample rate, sample size, and channel count,
 * using the Web Audio API for rates >= 22050 Hz or multi-channel targets and a simple
 * resampler otherwise; loop points are rescaled to the new sample count.
 * @param {number} _sampleRate Target sample rate in Hz.
 * @param {number} _sampleSize Target sample size in bits (8 or 16).
 * @param {number} _noOfChannels Target number of channels.
 * @param {number} _cnvStereoMode Stereo handling mode (one of SoundTools.CNV_STEREO_*).
 * @param {function} _callBack Called with true on success or false on failure.
 */
WaveSound.prototype.Convert=function(_sampleRate,_sampleSize,_noOfChannels,_cnvStereoMode,_callBack){
var newWave,newNoOfSamples=Math.floor(this.noOfSamples*_sampleRate/this.sampleRate),s,d,wdata,rdata=this.data,ws=44,wse=newNoOfSamples*_sampleSize/8+44;
var self=this,noOfSamples,OFFLINEAUDIOCONTEXT,oldNoOfSamples=this.noOfSamples,oldLoopStart=this.loopStart,oldLoopEnd=this.loopEnd;
	if(this.sampleRate==_sampleRate&&this.sampleSize==_sampleSize&&this.noOfChannels==_noOfChannels){
		if(_callBack!==undefined)_callBack(true);
		return;
	};
	// convert...
	if(_sampleRate>=22050||_noOfChannels>1){ 
		// use audio api...
		if(this.sampleSize==8){
			var d=new Uint8Array(self.data),i,l=self.noOfSamples,j=self.dataOffset,dd;
			self.CreateNew(self.sampleRate,16,self.noOfSamples,self.noOfChannels);
			if(self.noOfChannels==1){
				for(i=0;i<l;i++){
					self.data[44+i*2]=0;
					self.data[44+i*2+1]=d[j+i]-128;
				};
			}else{
				for(i=0;i<l;i++){
					self.data[44+i*2]=0;
					self.data[44+i*2+1]=d[j+i]-128;
					self.data[44+i*2+2]=0;
					self.data[44+i*2+3]=d[j+i+2]-128;
				};
			};
		};
		noOfSamples=Math.floor(self.noOfSamples*_sampleRate/self.sampleRate);
		OFFLINEAUDIOCONTEXT=new OfflineAudioContext(_noOfChannels,noOfSamples,_sampleRate);
		OFFLINEAUDIOCONTEXT.decodeAudioData(self.data.buffer,
			function(_audiobuffer){
			var d,dd,d1,dd1,i,oldNoOfSamples;
				self.valid=true;
				oldNoOfSamples=self.noOfSamples;
				self.CreateNew(_sampleRate,_sampleSize,noOfSamples,_noOfChannels);
				if(self.noOfChannels==1&&_audiobuffer.numberOfChannels==1){
					d=_audiobuffer.getChannelData(0);
					for(i=0;i<self.noOfSamples;i++){
						dd=Math.round(d[i]*32767);
						self.data[2*i+self.dataOffset]=dd&0xFF;
						self.data[2*i+self.dataOffset+1]=(dd&0xFF00)>>8;
					};
				}else if(self.noOfChannels==2&&_audiobuffer.numberOfChannels==1){
					d=_audiobuffer.getChannelData(0);
					for(i=0;i<self.noOfSamples;i++){
						dd=Math.round(d[i]*32767);
						self.data[4*i+self.dataOffset]=dd&0xFF;
						self.data[4*i+self.dataOffset+1]=(dd&0xFF00)>>8;
						self.data[4*i+self.dataOffset+2]=dd&0xFF;
						self.data[4*i+self.dataOffset+3]=(dd&0xFF00)>>8;
					};
				}else if(self.noOfChannels==1&&_audiobuffer.numberOfChannels==2){
					d=_audiobuffer.getChannelData(0);
					d1=_audiobuffer.getChannelData(1);
					for(i=0;i<self.noOfSamples;i++){
						dd1=Math.round(d1[i]*32767);
						dd=Math.round((d[i]*32767+dd1)/2);
						self.data[2*i+self.dataOffset]=dd&0xFF;
						self.data[2*i+self.dataOffset+1]=(dd&0xFF00)>>8;
					};
				}else if(self.noOfChannels==2&&_audiobuffer.numberOfChannels==2){
					d=_audiobuffer.getChannelData(0);
					d1=_audiobuffer.getChannelData(1);
					for(i=0;i<self.noOfSamples;i++){
						dd=Math.round(d[i]*32767);
						dd1=Math.round(d1[i]*32767);
						self.data[4*i+self.dataOffset]=dd&0xFF;
						self.data[4*i+self.dataOffset+1]=(dd&0xFF00)>>8;
						self.data[4*i+self.dataOffset+2]=dd1&0xFF;
						self.data[4*i+self.dataOffset+3]=(dd1&0xFF00)>>8;
					};
				};
				self.loopStart=-1;
				self.loopEnd=-1;
				if(oldLoopStart!=-1)self.loopStart=Math.floor(noOfSamples*oldLoopStart/oldNoOfSamples);
				if(oldLoopEnd!=-1)self.loopEnd=Math.floor(noOfSamples*oldLoopEnd/oldNoOfSamples);

				if(_callBack!==undefined)_callBack(true);
			},
			function(_error){
				if(_callBack!==undefined)_callBack(false);
			}
		);
	}else{
		// use own converter...
		newWave=new WaveSound(this.name);
		newWave.CreateNew(_sampleRate,_sampleSize,newNoOfSamples);
		newWave.SetZeroLine();
		wdata=newWave.data;
		if(this.sampleSize<_sampleSize){
			while(ws<wse){
				s=Math.round(((ws-44)*this.noOfSamples/(newNoOfSamples+1)))+this.dataOffset; 
				wdata[ws]=rdata[s+1];
				ws++;
			};
		}else if(this.sampleSize>_sampleSize){
			while(ws<wse){
				s=Math.round(((ws-44)*this.noOfSamples/(newNoOfSamples+1)))+this.dataOffset; 
				wdata[ws+1]=rdata[s];
				ws++;
			};
		}else{
			while(ws<wse){
				s=Math.round(((ws-44)*this.noOfSamples/(newNoOfSamples+1)))+this.dataOffset; 
				//log(ws,s);
				wdata[ws]=rdata[s];
				ws++;
			};
			//log(newNoOfSamples,this.noOfSamples);
		};
		this.loopStart=-1;
		this.loopEnd=-1;
		if(oldLoopStart!=-1)this.loopStart=Math.floor(newNoOfSamples*oldLoopStart/oldNoOfSamples);
		if(oldLoopEnd!=-1)this.loopEnd=Math.floor(newNoOfSamples*oldLoopEnd/oldNoOfSamples);
		this.sampleRate=_sampleRate;
		this.sampleSize=_sampleSize;
		this.noOfSamples=newNoOfSamples;
		this.data=newWave.data;	
		if(_callBack!==undefined)_callBack(true);
	};
};


/** Loads wave data from a URL, parses its format, and triggers the onload/onerror handlers.
 * @param {string} _url URL of the wave file to load.
 */
WaveSound.prototype.Load=function(_url){
var self=this;
	LoadBytes(_url,info,function(_bytes,_success,_info){
		if(_success){
			this.data=new Uint8Array(_bytes);
			this.GetAudioFormat();
			self.onerror(self);
		}else{
			self.onload(self);
		};
	});
};


/** Converts raw classic 8-bit sound files listed in a scan result into WAV files
 * (mono, 8 bit, 6289 Hz) and writes them to the given output path.
 * @param {string} _outPath Output directory path for the generated WAV files.
 * @param {string} _type Subdirectory/type name of the classic sound files.
 * @param {Object} _res Scan result object providing output.fileNames.
 */
SoundTools.prototype.ConvertClassicsSoundFilesToWaveSound=function(_outPath,_type,_res){
var i,l,fn,landno,data={};
	l=_res.output.fileNames.length;
	for(i=0;i<l;i++){
		fn=_res.output.fileNames[i].str_replace("\\","/").basename();
		var info={fnn:_outPath+fn.withoutSuffix().toLowerCase()+".wav"};
		LoadBytes("./dev/classicdata/sounds/"+_type+"/"+fn,info,function(_bytes,_success,_info){
			var bytes=new Uint8Array(_bytes);
			var i,flen,len=bytes.byteLength;
			var data=new Uint8Array(len+44);
			//log(_info.fnn,len);

			//RIFF
			data[0]=0x52;
			data[1]=0x49;
			data[2]=0x46;
			data[3]=0x46;
			flen=len+36;
			data[4]=(flen&0x000000FF);
			data[5]=(flen&0x0000FF00)>>8;
			data[6]=(flen&0x00FF0000)>>16;
			data[7]=(flen&0xFF000000)>>24;
			//WAVE
			data[8]=0x57;
			data[9]=0x41;
			data[10]=0x56;
			data[11]=0x45;
			//fmt
			data[12]=0x66;
			data[13]=0x6D;
			data[14]=0x74;
			data[15]=0x20;
			//fmt length
			data[16]=0x10;
			data[17]=0x00;
			data[18]=0x00;
			data[19]=0x00;
			//fmt tag (PCM)
			data[20]=0x01;
			data[21]=0x00;
			//channels
			data[22]=0x01;
			data[23]=0x00;
			//samplerate (6289Hz)
			data[24]=0x91;
			data[25]=0x18;
			data[26]=0x00;
			data[27]=0x00;
			//bytes/second
			data[28]=0xA0;
			data[29]=0x0F;
			data[30]=0x00;
			data[31]=0x00;
			//block align
			data[32]=0x01;
			data[33]=0x00;
			//bits/sample
			data[34]=0x08;
			data[35]=0x00;
			//dataheader
			data[36]=0x64;
			data[37]=0x61;
			data[38]=0x74;
			data[39]=0x61;
			//datablock length
			flen=len;
			data[40]=flen&0x000000FF;
			data[41]=(flen&0x0000FF00)>>8;
			data[42]=(flen&0x00FF0000)>>16;
			data[43]=(flen&0xFF000000)>>24;
		
			// wave data
			for(i=0;i<len;i++){
				data[44+i]=bytes[i];
			};
			µWriteFile(_info.fnn,base64ArrayBuffer(data),true); 
		});
	};
};



/** Loads multiple wave/MP3 sounds from URLs or File objects into this.loadedSnds,
 * reporting progress and errors via this.eventType and the callback.
 * @param {(string[]|File[])} _urlsOrInputOrSounds Array of URL strings or File objects to load.
 * @param {boolean} _onlyLoadMP3 If true, MP3 data is only decoded to AudioBuffers and not converted to PCM (default false).
 * @param {?function} _callBack Called with this instance on every load event (default null).
 */
SoundTools.prototype.LoadWaveSounds=function(_urlsOrInputOrSounds,_onlyLoadMP3=false,_callBack=null){
var self=this,sound,i;
var readers=[],rd,noofLoaded=0,noofErrLoaded=0;
	self.eventType=SoundTools.EVENT_READYNOSOUNDSTOLOAD;
	if(_urlsOrInputOrSounds.length==0){if(_callBack!=null)_callBack(self);return;}
	self.loadedSnds=[];
	if(typeof _urlsOrInputOrSounds[0]==="string"){
		// loading wave sounds by array of url strings...
		if(_urlsOrInputOrSounds.length==0){
			self.eventType=SoundTools.EVENT_SOUNDSLOADED;
			if(_callBack!=null)_callBack(self);
			return;
		};
		for(i=0;i<_urlsOrInputOrSounds.length;i++){
			var info={fn:_urlsOrInputOrSounds[i]};
			LoadBytes(_urlsOrInputOrSounds[i],info,function(_bytes,_success,_info){
				if(_success){
					new WaveSound(_info.fn.basename().withoutSuffix(),_bytes,_onlyLoadMP3,function(_waveSound,_success){
						if(_success){
							self.loadedSnds.push(_waveSound);
							noofLoaded++;
							self.eventType=SoundTools.EVENT_SOUNDLOADED;
							if(_callBack!=null)_callBack(self);
							if(noofLoaded==_urlsOrInputOrSounds.length){
								self.eventType=SoundTools.EVENT_SOUNDSLOADED;
								if(_callBack!=null)_callBack(self);
							};
						}else{
							noofErrLoaded++;
							errlog("sound load error:"+info.fn);
							self.eventType=SoundTools.EVENT_ERROR_SOUNDLOAD;
							if(_callBack!=null)_callBack(self);
						};
					});
				}else{
					errlog("sound load error:"+info.fn);
					self.eventType=SoundTools.EVENT_ERROR_SOUNDLOAD;
					if(_callBack!=null)_callBack(self);
				};
			});
		};		
	}else if(_urlsOrInputOrSounds[0] instanceof File){
		// loading sounds by given multiple upload input element...
		if(_urlsOrInputOrSounds.length==0){
			self.eventType=SoundTools.EVENT_SOUNDSLOADED;
			if(_callBack!=null)_callBack(self);
			return;
		};
		for(i=0;i<_urlsOrInputOrSounds.length;i++){
			rd=new FileReader();
			rd.soundName=_urlsOrInputOrSounds[i].name.basename().withoutSuffix();
			readers.push(rd);
			rd.onload=function(_ev){
				new WaveSound(this.soundName,new Uint8Array(this.result),_onlyLoadMP3,function(_waveSound,_success){
					if(_success){
						self.loadedSnds.push(_waveSound);
						noofLoaded++;
						self.eventType=SoundTools.EVENT_SOUNDLOADED;
						_callBack(self);
						if(noofLoaded==_urlsOrInputOrSounds.length){
							self.eventType=SoundTools.EVENT_SOUNDSLOADED;
							if(_callBack!=null)_callBack(self);
						};
					}else{
						self.eventType=SoundTools.EVENT_ERROR_SOUNDLOAD;
						if(_callBack!=null)_callBack(self);
					};
				});
			};
			rd.onerror=function(_ev){
				self.eventType=SoundTools.EVENT_ERROR_SOUNDLOAD;
				if(_callBack!=null)_callBack(self);
			};
			rd.readAsArrayBuffer(_urlsOrInputOrSounds[i]);
		};
	}else{
		self.eventType=SoundTools.EVENT_ERROR_SOUNDSLOAD;
		if(_callBack!=null)_callBack(self);
	};
	
};

/** Loads a set of sounds, converts them to a common format, marks duplicates,
 * and joins them into a single sound atlas; the resulting data URL and JSON timing
 * map are stored in this.result.
 * @param {(string[]|File[])} _urlsOrInputOrSounds Array of URL strings or File objects to load.
 * @param {Object} _opts Options: doMp3 (default false), mp3KBitRate (default 128), doCompare (default false), cnvSampleSize, cnvSampleRate, cnvNoOfChannels, and cnvStereo (CNV_* constants).
 * @param {function} _callBack Called with this instance on progress and when the result is ready.
 */
SoundTools.prototype.ConvertSoundSequence2SoundAtlas=function(_urlsOrInputOrSounds,_opts,_callBack){
var self=this,optDef={doMp3:false,mp3KBitRate:128,doCompare:false,cnvSampleSize:SoundTools.CNV_SAMPLESIZE_HIGHEST,cnvSampleRate:SoundTools.CNV_SAMPLERATE_HIGHEST,cnvNoOfChannels:SoundTools.CNV_NOOFCHANNELS_HIGHEST,cnvStereo:SoundTools.CNV_STEREO_KEEP};
	//log(_urlsOrInputOrSounds);
	if(_opts===undefined)_opts=optDef;
	if(ObjIsEmpty(_opts))_opts=optDef;
	if(!_opts.hasOwnProperty('doCompare'))_opts.doCompare=false;
	if(!_opts.hasOwnProperty('cnvSampleSize'))_opts.cnvSampleSize=SoundTools.CNV_SAMPLESIZE_HIGHEST;
	if(!_opts.hasOwnProperty('cnvSampleRate'))_opts.cnvSampleRate=SoundTools.CNV_SAMPLERATE_HIGHEST;
	if(!_opts.hasOwnProperty('cnvNoOfChannels'))_opts.cnvNoOfChannels=SoundTools.CNV_NOOFCHANNELS_HIGHEST;
	if(!_opts.hasOwnProperty('cnvStereo'))_opts.cnvStereo=SoundTools.CNV_STEREO_KEEP;
	if(!_opts.hasOwnProperty('doMp3'))_opts.doMp3=false;
	if(!_opts.hasOwnProperty('mp3KBitRate'))_opts.mp3KBitRate=128;
	_opts=Object.assign(optDef,_opts);
	
	self.opts=_opts;
	self.LoadWaveSounds(_urlsOrInputOrSounds,false,function(self){
	if(self.eventType!=SoundTools.EVENT_SOUNDSLOADED){
		_callBack(self);
		return;
	};
	var json={isMP3:_opts.doMp3,info:{orgs:{}},sounds:{}};
	var l,i,j,sampleSize=-1,sampleRate=-1,noOfChannels=1,stereoMode=0,allNoOfSamples,newWave,sampleWritePointer,oldSampleWritePointer;
		l=self.loadedSnds.length;
		//self.loadedSnds.reverse();
		// convert to unique sampleRate and sampleSize...
		if(_opts.cnvNoOfChannels==SoundTools.CNV_NOOFCHANNELS_HIGHEST){
			noOfChannels=1;
			for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].noOfChannels>noOfChannels)noOfChannels=self.loadedSnds[i].noOfChannels;
		}else if(_opts.cnvNoOfChannels==SoundTools.CNV_NOOFCHANNELS_LOWEST){
			noOfChannels=1;
			for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].noOfChannels<noOfChannels)noOfChannels=self.loadedSnds[i].noOfChannels;
		}else{
			noOfChannels=opts.cnvNoOfChannels;
		};
		if(_opts.cnvSampleSize==SoundTools.CNV_SAMPLESIZE_HIGHEST){
			sampleSize=8;
			for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleSize>sampleSize)sampleSize=self.loadedSnds[i].sampleSize;
		}else if(_opts.cnvSampleSize==SoundTools.CNV_SAMPLESIZE_LOWEST){
			sampleSize=16;
			for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleSize<sampleSize)sampleSize=self.loadedSnds[i].sampleSize;
		}else{
			sampleSize=_opts.cnvSampleSize;
		};
		if(_opts.cnvSampleRate==SoundTools.CNV_SAMPLERATE_HIGHEST){
			sampleRate=8000;
			for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleRate>sampleRate)sampleRate=self.loadedSnds[i].sampleRate;
		}else if(_opts.cnvSampleSize==SoundTools.CNV_SAMPLERATE_LOWEST){
			sampleRate=96000;
			for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleRate<sampleRate)sampleRate=self.loadedSnds[i].sampleRate;
		}else{
			sampleRate=_opts.cnvSampleRate;
		};

		/*-- @<BUILD_ONLY_ON_BUILDS:Never ----
		// split stereo...
		var newWaves=[],stereos;
		for(i=0;i<l;i++){
			if(self.loadedSnds[i].valid){
				if(self.loadedSnds[i].noOfChannels==2){
					stereos=self.loadedSnds[i].SeparateStereo();
					newWaves.push(stereos[0]);
					newWaves.push(stereos[1]);
				}else{
					newWaves.push(self.loadedSnds[i]);
				};
			};
		};
		self.loadedSnds=newWaves;
		l=self.loadedSnds.length;
		---- @>BUILD_ONLY_ON_BUILDS --*/
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)json.info.orgs[self.loadedSnds[i].name]=[self.loadedSnds[i].sampleRate,self.loadedSnds[i].sampleSize,0,0,self.loadedSnds[i].noOfSamples,self.loadedSnds[i].loopStart,self.loadedSnds[i].loopEnd];
		
		// marking duplicate sounds...
		for(i=0;i<l;i++){
			if(self.loadedSnds[i].valid){
				if(self.loadedSnds[i].equalTo==-1){
					for(j=i+1;j<l;j++){
						if(self.loadedSnds[j].valid){
							if(self.loadedSnds[j].equalTo==-1){
								if(self.loadedSnds[i].Compare(self.loadedSnds[j]))self.loadedSnds[j].equalTo=i;
							};
						};
					};
				};
			};
		};
		
		// correct sampleRate for mp3...
		if(_opts.doMp3){
			sampleSize=16;
			if(_opts.mp3KBitRate<128&&sampleRate>22050)sampleRate=22050;
			if(_opts.mp3KBitRate>=128)if(sampleRate<44100)sampleRate=44100;
		};
		//if(sampleRate>=22050||noOfChannels>1)sampleSize=16;
		
		json.sampleRate=sampleRate;
		json.bitRate=_opts.mp3KBitRate;
		json.sampleSize=sampleSize;
		json.noOfChannels=noOfChannels;
		
		// collect all together and return result...
		var noOfConverts=0,noOfConverted=0;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)noOfConverts++;
		for(i=0;i<l;i++){
			if(self.loadedSnds[i].valid){
				self.loadedSnds[i].Convert(sampleRate,sampleSize,noOfChannels,_opts.cnvStereo,function(){
					noOfConverted++;
					if(noOfConverted==noOfConverts){
						// collect all sounds to one wave sound...
						var i,l=self.loadedSnds.length,n=0;
						
						allNoOfSamples=0;
						for(i=0;i<l;i++){
							if(self.loadedSnds[i].valid&&self.loadedSnds[i].equalTo==-1){
								//allNoOfSamples+=self.loadedSnds[i].noOfSamples;
								allNoOfSamples+=self.loadedSnds[i].noOfSamples+Math.round(sampleRate/10);
								//allNoOfSamples=Math.ceil(self.loadedSnds[i].noOfSamples/1000/(sampleRate))*sampleRate/1000);
							};
						};
						json.noOfSamples=allNoOfSamples;
						
						newWave=new WaveSound("newWave");
						newWave.CreateNew(sampleRate,sampleSize,allNoOfSamples,noOfChannels);
						newWave.bitRate=_opts.mp3KBitRate;
						newWave.SetZeroLine();
						log(self.loadedSnds,newWave);
						sampleWritePointer=0;
						for(i=0;i<l;i++){
							if(self.loadedSnds[i].valid){
								if(self.loadedSnds[i].equalTo==-1){
									oldSampleWritePointer=sampleWritePointer;
									sampleWritePointer=newWave.Overwrite(sampleWritePointer,self.loadedSnds[i]);
									json.info.orgs[self.loadedSnds[i].name][SoundTools.ORG_STARTSAMPLE]=oldSampleWritePointer;
									json.info.orgs[self.loadedSnds[i].name][SoundTools.ORG_ENDSAMPLE]=sampleWritePointer;
									json.sounds[self.loadedSnds[i].name]=[oldSampleWritePointer/sampleRate,self.loadedSnds[i].noOfSamples/sampleRate,self.loadedSnds[i].loopStart==-1?-1:oldSampleWritePointer/sampleRate+self.loadedSnds[i].loopStart/sampleRate,self.loadedSnds[i].loopEnd==-1?-1:oldSampleWritePointer/sampleRate+self.loadedSnds[i].loopEnd/sampleRate];
									log(i,sampleWritePointer,self.loadedSnds[i].name);
									sampleWritePointer+=Math.round(sampleRate/10);
								}else{
									n++;
									j=self.loadedSnds[i].equalTo;
									log(i+"/"+n,"EQUAL",sampleWritePointer,self.loadedSnds[i].name,self.loadedSnds[j].name);
									json.info.orgs[self.loadedSnds[i].name]=json.info.orgs[self.loadedSnds[j].name];
									json.sounds[self.loadedSnds[i].name]=json.sounds[self.loadedSnds[j].name];
								};
							};
						};
						
						// output new wave sound and info json...
						self.result={};
						self.result.json=json;
								
						if(_opts.doMp3){
							newWave.ToMP3DataURL(function(_dataUrl){
								self.result.sndDataURL=_dataUrl;
								self.result.suffix="mp3";
								self.result.delSuffix="wav";
								self.eventType=SoundTools.EVENT_READY;
								_callBack(self);
							});
						}else{
							self.result.suffix="wav";
							self.result.delSuffix="mp3";
							self.result.sndDataURL=newWave.ToWaveDataURL("audio/wav");
							self.eventType=SoundTools.EVENT_READY;
							_callBack(self);
						};			
					};		
				});
			};
		};

	});
};

/** Rebuilds a single global sound atlas from already loaded sound resources by splitting
 * them into single waves, converting them to a common format, removing duplicates, and
 * joining them; the resulting data URL and JSON timing map are stored in this.result.
 * @param {Object} _soundRscs Sound resources object with soundsByURLs mapping URLs to sound sets.
 * @param {?Object} _useSounds If not null, only sounds whose names are keys of this object are included.
 * @param {Object} _opts Options: doMp3 (default false), mp3KBitRate (default 128), doCompare (default false), cnvSampleSize, cnvSampleRate, cnvNoOfChannels, and cnvStereo (CNV_* constants).
 * @param {function} _callBack Called with this instance when the atlas is ready.
 */
SoundTools.prototype.CreateGlobalSoundAtlas=function(_soundRscs,_useSounds,_opts,_callBack){
var self=this,optDef={doMp3:false,mp3KBitRate:128,doCompare:false,cnvSampleSize:SoundTools.CNV_SAMPLESIZE_HIGHEST,cnvSampleRate:SoundTools.CNV_SAMPLERATE_HIGHEST,cnvNoOfChannels:SoundTools.CNV_NOOFCHANNELS_HIGHEST,cnvStereo:SoundTools.CNV_STEREO_KEEP};
var soundSetUrl,soundName,soundOrgs;
var l,i,j,sampleSize=-1,sampleRate=-1,noOfChannels=1,stereoMode=0,allNoOfSamples,newWave,sampleWritePointer,oldSampleWritePointer;
var ws,nw,nd,od,no,oo,l,s;
	//log(_urlsOrInputOrSounds);
	if(_opts===undefined)_opts=optDef;
	if(ObjIsEmpty(_opts))_opts=optDef;
	if(!_opts.hasOwnProperty('doCompare'))_opts.doCompare=false;
	if(!_opts.hasOwnProperty('cnvSampleSize'))_opts.cnvSampleSize=SoundTools.CNV_SAMPLESIZE_HIGHEST;
	if(!_opts.hasOwnProperty('cnvSampleRate'))_opts.cnvSampleRate=SoundTools.CNV_SAMPLERATE_HIGHEST;
	if(!_opts.hasOwnProperty('cnvNoOfChannels'))_opts.cnvNoOfChannels=SoundTools.CNV_NOOFCHANNELS_HIGHEST;
	if(!_opts.hasOwnProperty('cnvStereo'))_opts.cnvStereo=SoundTools.CNV_STEREO_KEEP;
	if(!_opts.hasOwnProperty('doMp3'))_opts.doMp3=false;
	if(!_opts.hasOwnProperty('mp3KBitRate'))_opts.mp3KBitRate=128;
	_opts=Object.assign(optDef,_opts);

	self.loadedSnds=[];
	// split sounds to single waves...
	for(soundSetUrl in _soundRscs.soundsByURLs){
		soundSet=_soundRscs.soundsByURLs[soundSetUrl];
		//ws=new WaveSound(soundSetUrl,soundSet.buffer);
		ws=new WaveSound(soundSetUrl,soundSet.data);
		for(soundName in soundSet.info.info.orgs){
			soundOrgs=soundSet.info.info.orgs[soundName];
			//if(soundName.indexOf("Winch")>=0){
			//	ws=ws;
			//};
			nw=new WaveSound(soundName);
			nw.CreateNew(ws.sampleRate,ws.sampleSize,soundOrgs[SoundTools.ORG_ENDSAMPLE]-soundOrgs[SoundTools.ORG_STARTSAMPLE]-1,ws.noOfChannels);
			no=nw.dataOffset;
			oo=ws.dataOffset+soundOrgs[SoundTools.ORG_STARTSAMPLE]*ws.sampleSize/8*ws.noOfChannels;
			nd=nw.data;
			od=ws.data;
			nw.loopStart=soundOrgs[SoundTools.ORG_STARTLOOPSAMPLE];
			nw.loopEnd=soundOrgs[SoundTools.ORG_ENDLOOPSAMPLE];
			l=(soundOrgs[SoundTools.ORG_ENDSAMPLE]-soundOrgs[SoundTools.ORG_STARTSAMPLE]-1)*nw.sampleSize/8*nw.noOfChannels;
			for(s=0;s<l;s++)nd[s+no]=od[s+oo];
			if(_useSounds!=null){
				if(_useSounds.hasOwnProperty(soundName))self.loadedSnds.push(nw);
			}else{
				self.loadedSnds.push(nw);
			};
		};
	};
	// calculate unique noOfChannels, sampleRate and sampleSize...
	l=self.loadedSnds.length;
	if(_opts.cnvNoOfChannels==SoundTools.CNV_NOOFCHANNELS_HIGHEST){
		noOfChannels=1;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].noOfChannels>noOfChannels)noOfChannels=self.loadedSnds[i].noOfChannels;
	}else if(_opts.cnvNoOfChannels==SoundTools.CNV_NOOFCHANNELS_LOWEST){
		noOfChannels=1;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].noOfChannels<noOfChannels)noOfChannels=self.loadedSnds[i].noOfChannels;
	}else{
		noOfChannels=_opts.cnvNoOfChannels;
	};
	if(_opts.cnvSampleSize==SoundTools.CNV_SAMPLESIZE_HIGHEST){
		sampleSize=8;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleSize>sampleSize)sampleSize=self.loadedSnds[i].sampleSize;
	}else if(_opts.cnvSampleSize==SoundTools.CNV_SAMPLESIZE_LOWEST){
		sampleSize=16;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleSize<sampleSize)sampleSize=self.loadedSnds[i].sampleSize;
	}else{
		sampleSize=_opts.cnvSampleSize;
	};
	if(_opts.cnvSampleRate==SoundTools.CNV_SAMPLERATE_HIGHEST){
		sampleRate=8000;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleRate>sampleRate)sampleRate=self.loadedSnds[i].sampleRate;
		for(i=0;i<l;i++)log("sampleRate:"+self.loadedSnds[i].name+"="+self.loadedSnds[i].sampleRate);
	}else if(_opts.cnvSampleSize==SoundTools.CNV_SAMPLERATE_LOWEST){
		sampleRate=96000;
		for(i=0;i<l;i++)if(self.loadedSnds[i].valid)if(self.loadedSnds[i].sampleRate<sampleRate)sampleRate=self.loadedSnds[i].sampleRate;
	}else{
		sampleRate=_opts.cnvSampleRate;
	};	
	log("sampleRate="+sampleRate);
	
	// marking duplicate sounds...
	for(i=0;i<l;i++){
		if(self.loadedSnds[i].valid){
			if(self.loadedSnds[i].equalTo==-1){
				for(j=i+1;j<l;j++){
					if(self.loadedSnds[j].valid){
						if(self.loadedSnds[j].equalTo==-1){
							if(self.loadedSnds[i].Compare(self.loadedSnds[j]))self.loadedSnds[j].equalTo=i;
						};
					};
				};
			};
		};
	};

	// correct sampleRate for mp3...
	if(_opts.doMp3){
		sampleSize=16;
		if(_opts.mp3KBitRate<128&&sampleRate>22050)sampleRate=22050;
		if(_opts.mp3KBitRate>=128)if(sampleRate<44100)sampleRate=44100;
	};
	//if(sampleRate>=22050||noOfChannels>1)sampleSize=16;
	log("sampleRate="+sampleRate);
	
	// collect all together and return result...
	var json={sounds:{}};
	var noOfConverts=0,noOfConverted=0;
	for(i=0;i<l;i++)if(self.loadedSnds[i].valid)noOfConverts++;
	for(i=0;i<l;i++){
		if(self.loadedSnds[i].valid){
			self.loadedSnds[i].Convert(sampleRate,sampleSize,noOfChannels,_opts.cnvStereo,function(){
				noOfConverted++;
				if(noOfConverted==noOfConverts){
					// collect all sounds to one wave sound...
					var u,v=self.loadedSnds.length,n=0;
					allNoOfSamples=0;
					for(u=0;u<v;u++){
						if(self.loadedSnds[u].valid&&self.loadedSnds[u].equalTo==-1){
							//allNoOfSamples+=self.loadedSnds[i].noOfSamples;
							allNoOfSamples+=self.loadedSnds[u].noOfSamples+Math.round(sampleRate/10);
							//allNoOfSamples=Math.ceil(self.loadedSnds[i].noOfSamples/1000/(sampleRate))*sampleRate/1000);
						};
					};
					//µWriteFile("E:\\Sites\\oxyd\\dev\\newmodels\\NGBaseObject\\test.wav",self.loadedSnds[0].toDataURL().split(",")[1],true);
					newWave=new WaveSound("newWave");
					newWave.CreateNew(sampleRate,sampleSize,allNoOfSamples,noOfChannels);
					newWave.bitRate=_opts.mp3KBitRate;
					newWave.SetZeroLine();
					log(self.loadedSnds,newWave);
					sampleWritePointer=0;
					for(u=0;u<v;u++){
						if(self.loadedSnds[u].valid){
							oldSampleWritePointer=sampleWritePointer;
							if(self.loadedSnds[u].equalTo==-1){
								//if(self.loadedSnds[u].name.indexOf("Winch")>=0){
								//	v=v;
								//};
								sampleWritePointer=newWave.Overwrite(sampleWritePointer,self.loadedSnds[u]);
								log(u,sampleWritePointer,self.loadedSnds[u].name);
								json.sounds[self.loadedSnds[u].name]=[oldSampleWritePointer/sampleRate,
								self.loadedSnds[u].noOfSamples/sampleRate,
								self.loadedSnds[u].loopStart==-1?-1:oldSampleWritePointer/sampleRate+self.loadedSnds[u].loopStart/sampleRate,
								self.loadedSnds[u].loopEnd==-1?-1:oldSampleWritePointer/sampleRate+self.loadedSnds[u].loopEnd/sampleRate];
								sampleWritePointer+=Math.round(sampleRate/10);
							}else{
								j=self.loadedSnds[u].equalTo;
								n++;
								log(u+"/"+n,"EQUAL",sampleWritePointer,self.loadedSnds[u].name,self.loadedSnds[j].name);
								json.sounds[self.loadedSnds[u].name]=json.sounds[self.loadedSnds[j].name];
							};
						};
					};
					
					// output new wave sound and info json...
					self.result={};
					self.result.json=json;
							
					if(_opts.doMp3){
						newWave.ToMP3DataURL(function(_dataUrl){
							self.result.sndDataURL=_dataUrl;
							self.result.suffix="mp3";
							self.result.delSuffix="wav";
							self.eventType=SoundTools.EVENT_READY;
							_callBack(self);
						});
					}else{
						self.result.suffix="wav";
						self.result.delSuffix="mp3";
						self.result.sndDataURL=newWave.ToWaveDataURL("audio/wav");
						self.eventType=SoundTools.EVENT_READY;
						_callBack(self);
					};			
				};		
			});
		};
	};
};


/** Extracts a section of an AudioBuffer into a new AudioBuffer.
 * @param {AudioBuffer} _srcAudioBuffer Source audio buffer.
 * @param {number} _start Start position in seconds.
 * @param {number} _duration Duration of the section in seconds.
 * @returns {AudioBuffer} New audio buffer containing the extracted section.
 */
SoundTools.prototype.ExtractAudioBuffer=function(_srcAudioBuffer,_start,_duration){
var buffer=AUDIOCONTEXT.createBuffer(_srcAudioBuffer.numberOfChannels,_srcAudioBuffer.sampleRate*_duration,_srcAudioBuffer.sampleRate);
var srcChanData,dstChanData,c,offset=Math.floor(_start*_srcAudioBuffer.sampleRate);
	for(c=0;c<_srcAudioBuffer.numberOfChannels;c++){
		srcChanData=_srcAudioBuffer.getChannelData(c);
		dstChanData=buffer.getChannelData(c);
		for(s=0;s<buffer.length;s++){
			dstChanData[s]=srcChanData[s+offset];
		};
	};
	return buffer;
};


/*-- @<BUILD_NEVER_ON_BUILDS:Release,Debug --*/
//	===============================================
//	Unit Tests
//	===============================================

/** Unit test stub for SoundTools (excluded from release builds). */
function SoundTest(){
var sc=new SoundTools(),urls,opt;
	
};
/*-- @>BUILD_NEVER_ON_BUILDS --*/
