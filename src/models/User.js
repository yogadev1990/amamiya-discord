const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // --- Identitas Utama ---
    userId: { type: String, required: true, unique: true }, // ID Discord
    robloxId: { type: String, default: null }, // ID Roblox (Jembatannya!)
    
    username: String, // Username Discord
    robloxUsername: String, // Username Roblox (Opsional, buat display aja)

    // --- Statistik (Sinkron Discord <-> Roblox) ---
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    gold: { type: Number, default: 1000 }, // Uang berlaku di dua dunia
    
    // --- Inventory (Sinkron!) ---
    // Kalau dia beli alat di Discord, alatnya muncul di Roblox
    inventory: [
        {
            itemId: String,    // Cth: 'high_speed_drill'
            itemName: String,  // Cth: 'High Speed Drill'
            rarity: String,    
            obtainedAt: { type: Date, default: Date.now }
        }
    ],

    // --- Data Akademik (Discord Only) ---
    totalStudy: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null },
    schedule: [
        { hari: String, jam: String, matkul: String }
    ],

    // --- History Chat (Gabungan Chat Discord + Chat sama Budiono di Roblox) ---
    chatHistory: [
        {
            source: { type: String, enum: ['discord', 'roblox'] }, // Tau ini chat dari mana
            role: { type: String, enum: ['user', 'model'] },
            parts: [{ text: String }],
            timestamp: { type: Date, default: Date.now }
        }
    ]
});

module.exports = mongoose.model('User', userSchema);