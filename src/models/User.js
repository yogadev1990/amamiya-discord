const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    inventory: [
        {
            itemId: String,    // ID unik item, misal: 'sonde_half'
            itemName: String,  // Nama tampilan: 'Sonde Half Moon'
            rarity: String,    // Common, Rare, Epic, Legendary
            obtainedAt: { type: Date, default: Date.now }
        }
    ],
    gold: { type: Number, default: 1000 }, // Modal awal mahasiswa baru
    lastDaily: { type: Date, default: null }, // Kapan terakhir absen
    chatHistory: [
        {
            role: { type: String, enum: ['user', 'model'] },
            parts: [
                { 
                    text: String,
                    // TAMBAHAN PENTING: Struktur untuk file (Gambar/PDF)
                    inlineData: {
                        data: String,
                        mimeType: String
                    }
                }
            ],
            timestamp: { type: Date, default: Date.now }
        }
    ],
    lastInteraction: { type: Date, default: Date.now },
    
    // --- TAMBAHAN BARU DI SINI ---
    schedule: [
        {
            hari: String,    // senin, selasa...
            jam: String,     // 08:00
            matkul: String   // Blok 9: Etika
        }
    ]
    // -----------------------------
});

module.exports = mongoose.model('User', userSchema);