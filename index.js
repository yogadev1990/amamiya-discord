require('dotenv').config();
const mongoose = require('mongoose');
const { startMainBot } = require('./src/bots/main/index');

// Penanganan global error agar bot tidak crash saat ada glitch koneksi/DNS (seperti EAI_AGAIN)
process.on('unhandledRejection', (error) => {
    console.error('⚠️ [Unhandled Rejection]:', error.message || error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ [Uncaught Exception]:', error.message || error);
});

(async () => {
    try {
        console.log('📡 Menghubungkan ke database...');
        await mongoose.connect(process.env.MONGO_URI, {
            family: 4, 
        });
        console.log('🍃 Terhubung ke MongoDB Atlas!');

        // 1. Jalankan Main Bot
        await startMainBot();

        // 2. Jalankan Radio Bot
        // radio.js (src/bots/radio/index.js) sudah memanggil client.login() di dalamnya.
        require('./src/bots/radio/index');

        // 3. Jalankan Sinkronisasi OAI-PMH Skripsi Unsri di background
        const { startPeriodicHarvesting } = require('./src/services/oaiService');
        startPeriodicHarvesting(24);

        console.log('🚀 Semua layanan bot (Main Bot, Radio Bot, OAI Harvester) telah berjalan!');
    } catch (error) {
        console.error('❌ Gagal menjalankan Amamiya Orchestrator:', error.message);
        process.exit(1);
    }
})();
