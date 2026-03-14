const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
// Asumsi: Anda juga sudah mengubah file socketHandler.js menggunakan module.exports
const { setupSocketHandlers } = require('./src/sockets/socketHandler.js'); 

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Serve file statis
app.use(express.static(path.join(__dirname, 'public')));
app.use('/materi', express.static(path.join(__dirname, 'materi')));

// Bungkus fungsi jalankan server agar bisa dipanggil dari index.js
function startWebServer() {
    const PORT = process.env.PORT || 3000;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error("❌ GAGAL: GEMINI_API_KEY tidak ditemukan di file .env");
        process.exit(1);
    }

    // Inisialisasi logika Socket.IO
    setupSocketHandlers(io, GEMINI_API_KEY);

    server.listen(PORT, () => {
        console.log(`🌐 Web Server Waguri berjalan di http://localhost:${PORT}`);
    });
}

// Ekspor instance io dan fungsinya
module.exports = { io, startWebServer };