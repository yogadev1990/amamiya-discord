require('dotenv').config();
const { harvestFromOai, getLocalSkripsi } = require('../src/services/oaiService');

async function run() {
    console.log('🚀 [Manual Sync] Memulai sinkronisasi skripsi Unsri OAI 2.0...');
    const countBefore = getLocalSkripsi().length;
    console.log(`📊 Total skripsi lokal saat ini: ${countBefore}`);

    const newCount = await harvestFromOai();
    const countAfter = getLocalSkripsi().length;
    console.log(`🏁 Sinkronisasi selesai. Skripsi baru: +${newCount}. Total sekarang: ${countAfter}`);
}

run().catch(console.error);
