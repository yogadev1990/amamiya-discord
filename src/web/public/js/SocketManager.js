export class SocketManager {
    constructor(callbacks) {
        this.socket = null;
        this.callbacks = callbacks; // { onStatus, onText, onAudio, onImage }
        this.isConnected = false;
    }

    // TERIMA PARAMETER DARI main.js
    connect(userId, sessionId) {
        // HANYA PANGGIL io() SATU KALI DI SINI
        this.socket = io({ 
            query: { 
                userId: userId,
                sessionId: sessionId
            } 
        });

        this.socket.on('connect', () => {
            this.isConnected = true;
            if (this.callbacks.onStatus) this.callbacks.onStatus('🟠 Menghubungkan ke Gemini...');
        });

        this.socket.on('message', (data) => {
            if (data.type === 'status') {
                if (this.callbacks.onStatus) this.callbacks.onStatus(data.message);
            } else if (data.type === 'text') {
                if (this.callbacks.onText) this.callbacks.onText(data.text);
            } else if (data.type === 'audio') {
                if (this.callbacks.onAudio) this.callbacks.onAudio(data.data);
            } else if (data.type === 'show_image' && this.callbacks.onImage) {
                this.callbacks.onImage(data.url);
            }
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            if (this.callbacks.onStatus) this.callbacks.onStatus('🔴 Terputus dari Server Lokal.');
        });
    }

    sendSetup() {
        if (this.isConnected) {
            this.socket.emit('message', { type: 'setup' });
        }
    }

    sendAudio(base64Data) {
        if (this.isConnected) {
            this.socket.emit('message', { type: 'audio', data: base64Data });
        }
    }
}