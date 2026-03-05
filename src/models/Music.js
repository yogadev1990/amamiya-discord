const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
    // ID Server Discord (Guild)
    guildId: { type: String, required: true, unique: true }, 
    
    // --- Konfigurasi Publik 24/7 ---
    radioConfig: {
        isActive: { type: Boolean, default: true }, // Menandakan apakah mode radio 24/7 aktif
        lastRadioName: { type: String, default: 'Zeno FM Default' }, // Nama stasiun radio terakhir
        lastRadioUrl: { type: String, default: 'http://stream-178.zeno.fm/f3wvbbqmdg8uv' } // URL stream terakhir
    }
});

module.exports = mongoose.model('Music', musicSchema);