export class AudioManager {
    constructor(onAudioCaptured, onPlaybackEnd) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        this.onAudioCaptured = onAudioCaptured; 
        this.onPlaybackEnd = onPlaybackEnd;     

        this.isSpeaking = false;
        this.currentVolume = 0;
        this.audioQueue = []; 
        this.isPlaying = false;
        
        // 2. PERBAIKAN: Penanda waktu untuk Gapless Playback
        this.nextPlaybackTime = 0;

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.connect(this.audioCtx.destination);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    async startMicrophone() {
        await this.audioCtx.resume();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Perbaikan Sample Rate Mic agar tetap 16kHz untuk API Gemini
            const micCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const source = micCtx.createMediaStreamSource(stream);
            const processor = micCtx.createScriptProcessor(4096, 1, 1);
            
            source.connect(processor);
            processor.connect(micCtx.destination); 

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                const uint8 = new Uint8Array(pcm16.buffer);
                let binary = '';
                for (let i = 0; i < uint8.length; i += 0x8000) {
                    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + 0x8000));
                }
                
                if (this.onAudioCaptured) {
                    this.onAudioCaptured(btoa(binary));
                }
            };

            this._monitorVolume();
        } catch (err) {
            console.error("Gagal mengakses mikrofon:", err);
        }
    }

    enqueueAudio(base64Data) {
        const binary = atob(base64Data);
        const uint8Array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            uint8Array[i] = binary.charCodeAt(i);
        }
        
        const int16Array = new Int16Array(uint8Array.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        const audioBuffer = this.audioCtx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.copyToChannel(float32Array, 0);

        this.audioQueue.push(audioBuffer);
        this._schedulePlayback(); // Panggil penjadwalan gapless
    }

    // 3. PERBAIKAN: Algoritma Gapless Playback
    _schedulePlayback() {
        while (this.audioQueue.length > 0) {
            const buffer = this.audioQueue.shift();
            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
            
            // Pengaturan Suara Waguri
            source.playbackRate.value = 1.05; 
            source.detune.value = 0; 

            source.connect(this.analyser);
            
            // Hitung kapan potongan audio ini harus mulai diputar
            let startTime = this.nextPlaybackTime;
            
            // Jika antrean sempat kosong dan audio telat datang (lag internet),
            // reset waktu mulai ke waktu sekarang
            if (startTime < this.audioCtx.currentTime) {
                startTime = this.audioCtx.currentTime;
            }

            source.start(startTime);
            
            // Hitung durasi aktual setelah kecepatan diubah (playbackRate)
            const actualDuration = buffer.duration / source.playbackRate.value;
            
            // Jadwalkan potongan berikutnya tepat di ujung potongan ini (tanpa gap)
            this.nextPlaybackTime = startTime + actualDuration;

            this.isPlaying = true;
            this.isSpeaking = true;

            // Deteksi saat benar-benar selesai bicara (semua antrean habis)
            source.onended = () => {
                if (this.audioQueue.length === 0 && this.audioCtx.currentTime >= this.nextPlaybackTime - 0.1) {
                    this.isPlaying = false;
                    this.isSpeaking = false;
                    if (this.onPlaybackEnd) this.onPlaybackEnd();
                }
            };
        }
    }

    _monitorVolume() {
        const updateVolume = () => {
            if (this.isSpeaking) {
                this.analyser.getByteTimeDomainData(this.dataArray);
                let sum = 0;
                for(let i = 0; i < this.dataArray.length; i++) {
                    const val = (this.dataArray[i] - 128) / 128;
                    sum += val * val;
                }
                this.currentVolume = Math.sqrt(sum / this.dataArray.length);
            } else {
                this.currentVolume = 0;
            }
            requestAnimationFrame(updateVolume);
        };
        updateVolume();
    }
}