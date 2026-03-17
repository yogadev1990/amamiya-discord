require('dotenv').config();
const mongoose = require('mongoose');
const { startWebServer } = require('./src/web/server');
const { startMainBot } = require('./src/bots/main/index');
// require('./src/bots/radio/index'); // Logika radio.js punya client.login sendiri

(async () => {
    try {
        console.log('📡 Menghubungkan ke database...');
        await mongoose.connect(process.env.MONGO_URI, {
            family: 4, 
        });
        console.log('🍃 Terhubung ke MongoDB Atlas!');

        // 1. Jalankan Web Server (Dashboard & Sockets)
        const { io } = require('./src/web/server'); // Kita ambil io dari sini setelah dipanggil? 
        // Sebenarnya startWebServer() sudah dipanggil di bawah
        startWebServer();

        // 2. Jalankan Main Bot
        await startMainBot(io);

        // 3. Jalankan Radio Bot
        // radio.js (src/bots/radio/index.js) sudah memanggil client.login() di dalamnya.
        // Cukup kita require agar kodenya dijalankan.
        require('./src/bots/radio/index');

        console.log('🚀 Semua layanan (Main Bot, Radio Bot, Web) telah berjalan!');
    } catch (error) {
        console.error('❌ Gagal menjalankan Amamiya Orchestrator:', error.message);
        process.exit(1);
    }
})();
