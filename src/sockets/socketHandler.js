const { GeminiClient } = require('./geminiClient');
const User = require('../shared/models/User'); 

function setupSocketHandlers(io, apiKey) {
    io.on('connection', async (socket) => {
        // BUNGKUS DENGAN TRY CATCH AGAR ERROR TIDAK DITELAN
        try {
            console.log(`\n🌐 [STEP 1] Klien Web Avatar terhubung: ${socket.id}`);

            const userId = socket.handshake.query.userId;
            let userName = "Mahasiswa"; 

            console.log(`[STEP 2] Memeriksa MongoDB untuk User ID: ${userId}`);

            // Cek agar 'null' atau 'undefined' dari browser tidak ikut dicari
            if (userId && userId !== 'null' && userId !== 'undefined') {
                const userProfile = await User.findOne({ userId: userId });
                if (userProfile && userProfile.username) {
                    userName = userProfile.username;
                }
            }

            console.log(`[STEP 3] Login sebagai: ${userName}. Menginisiasi Gemini...`);

            // Pastikan nama variabelnya KONSISTEN di sini
            const gemini = new GeminiClient(
                apiKey, 
                (msg) => { socket.emit('message', msg); },
                () => { socket.disconnect(); },
                userName
            );

            console.log(`[STEP 4] Menghubungi Server Google API...`);
            gemini.connect();

            // Tangani pesan dari Browser
            socket.on('message', (payload) => {
                try {
                    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
                    if (data.type === 'setup') {
                        gemini.sendSetup();
                    } else if (data.type === 'audio') {
                        gemini.sendAudio(data.data);
                    }
                } catch (error) {
                    console.error("❌ Gagal memproses pesan audio/setup dari klien:", error);
                }
            });

            // Tangani pemutusan koneksi
            socket.on('disconnect', () => {
                console.log(`❌ Klien Web Avatar terputus: ${socket.id}`);
                gemini.disconnect();
            });

        } catch (fatalError) {
            // JIKA ADA SALAH KETIK ATAU CRASH, AKAN MUNCUL DI SINI!
            console.error("🚨 ERROR FATAL DI SOCKET HANDLER:", fatalError);
        }
    });
}

module.exports = { setupSocketHandlers };