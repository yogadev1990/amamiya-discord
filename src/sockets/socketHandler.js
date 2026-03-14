const { GeminiClient } = require('./geminiClient');
const User = require('../models/User'); // Sesuaikan path ini jika posisi model Anda berbeda

function setupSocketHandlers(io, apiKey) {
    io.on('connection', async (socket) => {
        console.log(`🌐 Klien terhubung via Socket.IO: ${socket.id}`);

        // 1. Ambil ID yang dikirim dari browser
        const userId = socket.handshake.query.userId;
        let userName = "Mahasiswa"; // Default

        // 2. Cari di database MongoDB (pastikan userId bukan string 'null')
        if (userId && userId !== 'null') {
            try {
                const userProfile = await User.findOne({ userId: userId });
                if (userProfile && userProfile.username) {
                    userName = userProfile.username;
                    console.log(`[Login] ${userName} memasuki ruangan Waguri.`);
                }
            } catch (err) {
                console.error("Gagal mencari profil user:", err);
            }
        }

        // 3. Masukkan nama ke dalam mesin Gemini
        const geminiClient = new GeminiClient(
            apiKey, 
            (msg) => { socket.emit('message', msg); },
            () => { socket.disconnect(); },
            userName
        );

        // Mulai koneksi ke Google API
        geminiClient.connect();

        // Tangani pesan dari Browser
        socket.on('message', (payload) => {
            try {
                const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

                if (data.type === 'setup') {
                    geminiClient.sendSetup();
                } else if (data.type === 'audio') {
                    geminiClient.sendAudio(data.data);
                }
            } catch (error) {
                console.error("Gagal memproses pesan klien:", error);
            }
        });

        // Tangani pemutusan koneksi Browser
        socket.on('disconnect', () => {
            console.log(`Klien terputus: ${socket.id}`);
            geminiClient.disconnect();
        });
    });
}

// Ekspor ke web.js menggunakan format CommonJS
module.exports = { setupSocketHandlers };