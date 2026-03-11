// web.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Folder publik untuk menaruh build frontend ChatVRM/Three.js
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`🌐 Klien Web Avatar terhubung: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`❌ Klien Web Avatar terputus: ${socket.id}`);
    });
});

// Jalankan server
server.listen(3000, () => {
    console.log('🚀 Web Server & Socket.IO berjalan di port 3000');
});

// Ekspor io agar bisa ditarik oleh sistem command bot Discord
//module.exports = { io };