const { GeminiClient } = require('./geminiClient');
const User = require('../models/User'); // Sesuaikan path ini jika posisi model Anda berbeda

function setupSocketHandlers(io, apiKey) {
io.on('connection', async (socket) => {
        console.log(`🌐 Klien terhubung via Socket.IO: ${socket.id}`);

        const userId = socket.handshake.query.userId;
        let userName = "Mahasiswa"; 

        // --- BYPASS MONGODB SEMENTARA ---
        // Jika kode ini jalan, berarti Mongoose/MongoDB Anda yang membuat sistem hang
        /*
        if (userId && userId !== 'null') {
            try {
                const userProfile = await User.findOne({ userId: userId });
                if (userProfile && userProfile.username) {
                    userName = userProfile.username;
                }
            } catch (err) {
                console.error("Gagal mencari profil user:", err);
            }
        }
        */
        
        console.log(`[Login] ${userName} memasuki ruangan Waguri.`);

        // Masukkan nama ke dalam mesin Gemini
        const geminiClient = new GeminiClient(
            apiKey, 
            (msg) => { socket.emit('message', msg); },
            () => { socket.disconnect(); },
            userName
        );

        // Mulai koneksi ke Google API
        geminiClient.connect();

        socket.on('message', (payload) => {
            try {
                const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
                if (data.type === 'setup') geminiClient.sendSetup();
                else if (data.type === 'audio') geminiClient.sendAudio(data.data);
            } catch (error) {
                console.error("Gagal memproses pesan klien:", error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`❌ Klien terputus: ${socket.id}`);
            geminiClient.disconnect();
        });
    });
}

// Ekspor ke web.js menggunakan format CommonJS
module.exports = { setupSocketHandlers };