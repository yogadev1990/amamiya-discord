export class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.isSpeaking = false;
    }

    init() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    createWavFromPCM(base64PCM, sampleRate = 24000) {
        const binary = atob(base64PCM);
        const pcmLength = binary.length;
        const pcmData = new Uint8Array(pcmLength);

        for (let i = 0; i < pcmLength; i++) {
            pcmData[i] = binary.charCodeAt(i);
        }

        const buffer = new ArrayBuffer(44 + pcmLength);
        const view = new DataView(buffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, "RIFF");
        view.setUint32(4, 36 + pcmLength, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, pcmLength, true);

        new Uint8Array(buffer, 44).set(pcmData);
        return new Blob([buffer], { type: "audio/wav" });
    }

    play(base64Data, onEndedCallback) {
        if (!this.audioCtx) this.init();

        const wavBlob = this.createWavFromPCM(base64Data);
        const audioURL = URL.createObjectURL(wavBlob);
        const audio = new Audio(audioURL);

        const source = this.audioCtx.createMediaElementSource(audio);
        source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        audio.play();
        this.isSpeaking = true;

        audio.onended = () => {
            this.isSpeaking = false;
            URL.revokeObjectURL(audioURL);
            if (onEndedCallback) onEndedCallback();
        };
    }

    getVolume() {
        if (!this.analyser) return 0;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
        return sum / this.dataArray.length;
    }
}