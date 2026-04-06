// --- UBAH IMPORT MENJADI REQUIRE ---
const { WebSocket } = require('ws');
const { searchMateriKuliah } = require('../services/milvusService');

// --- HAPUS KATA 'export' DARI DEKLARASI CLASS ---
class GeminiClient {
    // 1. Tambahkan parameter 'userName' di constructor
    constructor(apiKey, onMessage, onClose, userName = "Mahasiswa") {
        this.apiKey = apiKey;
        this.onMessage = onMessage; 
        this.onClose = onClose;
        this.userName = userName; // Menyimpan nama user dari MongoDB
        
        this.ws = null;
        this.idleTimer = null; // Variabel untuk timer 10 menit
    }

    connect() {
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log(`Server Node.js terhubung ke Gemini Live API (User: ${this.userName})`);
            this.onMessage({ type: 'status', message: `🟢 Waguri Siap Mendengar ${this.userName}` });
            
            // 2. Mulai timer 10 menit saat koneksi pertama kali terbuka
            this.resetIdleTimer();
        });

        this.ws.on('message', (data) => {
            this.handleResponse(data);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`🔴 Koneksi Gemini tertutup. Kode: ${code}`);
            if (this.onClose) this.onClose();
        });

        this.ws.on('error', (error) => {
            console.error("Error pada WebSocket Gemini:", error);
        });
    }

    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        
        // 5 menit = 300.000 milidetik
        this.idleTimer = setTimeout(() => {
            console.log(`⏱️ [TIMEOUT] Sesi atas nama ${this.userName} dihentikan otomatis karena tidak aktif selama 5 menit.`);
            
            // Beri tahu frontend bahwa kelas bubar
            this.onMessage({ type: 'status', message: '🔴 Sesi otomatis berakhir karena tidak ada aktivitas (5 Menit).' });
            
            // Putuskan koneksi Google
            this.disconnect();
        }, 300000); 
    }

    sendSetup() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            setup: {
                model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Despina"
                            }
                        }
                    }
                },
                systemInstruction: {
                    // 3. Masukkan nama user ke dalam otak Waguri!
                    parts: [{ text: `Kamu adalah Waguri, asisten AI 3D/dosen. Saat ini kamu sedang berbicara empat mata dengan pengguna bernama ${this.userName}. Sapa dia dengan namanya sesekali. Jawablah dengan imut tapi informatif. Gunakan alat cari_materi_kuliah jika ditanya tentang teori.` }]
                },
                outputAudioTranscription: {},
                // --- PENAMBAHAN ALAT (TOOLS) ---
                tools: [{
                    functionDeclarations: [{
                        name: "cari_materi_kuliah",
                        description: "Mencari literatur atau materi spesifik dari database.",
                        parameters: {
                            type: "OBJECT",
                            properties: {
                                query: {
                                    type: "STRING",
                                    description: "Kata kunci spesifik untuk dicari di database."
                                }
                            },
                            required: ["query"]
                        }
                    }]
                }]
                // -------------------------------
            }
        }));
    }

    async handleResponse(data) {
        try {
            let messageText = data;
            if (data instanceof Buffer) {
                messageText = data.toString('utf8');
            }
            const response = JSON.parse(messageText);

            // 1. TANGKAP SINYAL SETUP COMPLETE
            if (response.setupComplete) {
                this.onMessage({ type: 'status', message: '🟢 Setup Selesai, Silakan Bicara!' });
                return; 
            }

            // 2. TANGANI PERMINTAAN ALAT (FUNCTION CALLING)
            if (response.toolCall) {
                // LOG 1: Lihat apa yang sebenarnya diminta oleh Google
                console.log("\n🛠️ [Gemini Minta Alat]:", JSON.stringify(response.toolCall, null, 2));
                
                const functionCalls = response.toolCall.functionCalls;
                const functionResponsesArray = []; // Kumpulkan semua balasan di sini
                
                for (const call of functionCalls) {
                    if (call.name === "cari_materi_kuliah") {
                        const query = call.args.query;
                        this.onMessage({ type: 'status', message: `🔍 Waguri sedang mencari materi: "${query}"...` });
                        
                        try {
                            // Eksekusi Milvus
                            const searchData = await searchMateriKuliah(query);
                            
                            // PERUBAHAN: Selalu kirim event show_image. 
                            // Jika gambar ada, kirim base64-nya. Jika tidak ada, kirim null untuk mereset papan.
                            this.onMessage({ type: 'show_image', url: searchData.image || null });
                            
                            // Kirimkan teks ke Gemini untuk diucapkan
                            functionResponsesArray.push({
                                id: call.id,
                                name: call.name,
                                response: { result: searchData.text } 
                            });
                        } catch (error) {
                            console.error("Gagal menjalankan Milvus:", error);
                            functionResponsesArray.push({
                                id: call.id,
                                name: call.name,
                                response: { error: "Maaf, database sedang tidak dapat diakses." }
                            });
                        }
                    }
                }

                // Bungkus array ke dalam payload tunggal
                const payload = {
                    toolResponse: {
                        functionResponses: functionResponsesArray
                    }
                };

                // LOG 2: Lihat apa yang kita kirimkan ke Google
                console.log("📤 [Balasan Ke Gemini]:", JSON.stringify(payload, null, 2));
                
                // Kirim balasan ke Google
                this.ws.send(JSON.stringify(payload));
                return; // Wajib di-return
            }

            // 3. TANGANI AUDIO NORMAL
            if (response.serverContent?.modelTurn) {
                const parts = response.serverContent.modelTurn.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        this.onMessage({ type: 'audio', data: part.inlineData.data });
                    }
                }
            }

            // 4. TANGANI TRANSKRIPSI AUDIO
            if (response.serverContent?.outputTranscription) {
                const transcriptText = response.serverContent.outputTranscription.text;
                if (transcriptText) {
                    this.onMessage({ type: 'text', text: transcriptText });
                }
            }

        } catch (error) {
            console.error("Gagal memproses data dari Gemini:", error);
        }
    }

    sendAudio(base64Data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Reset timer setiap kali user mengirimkan suara (bicara)
        this.resetIdleTimer(); 

        this.ws.send(JSON.stringify({
            realtimeInput: {
                mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Data }]
            }
        }));
    }

    disconnect() {
        if (this.idleTimer) clearTimeout(this.idleTimer); // Bersihkan timer
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }
}

// --- WAJIB: EKSPOR SEBAGAI MODULE.EXPORTS ---
module.exports = { GeminiClient };