const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { setupSocketHandlers } = require('./src/sockets/socketHandler'); 

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/materi', express.static(path.join(__dirname, 'materi')));

function startWebServer() {
    const PORT = process.env.PORT || 3000;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error("❌ GAGAL: GEMINI_API_KEY tidak ditemukan di file .env");
        process.exit(1);
    }

    // MEMANGGIL SOCKET HANDLER (Hanya satu baris ini saja!)
    setupSocketHandlers(io, GEMINI_API_KEY);

    server.listen(PORT, () => {
        console.log(`🚀 Web Server & Socket.IO berjalan di port ${PORT}`);
    });
}

module.exports = { io, startWebServer };