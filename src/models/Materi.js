const mongoose = require('mongoose');

const materiSchema = new mongoose.Schema({
    fileHash: { type: String, required: true, unique: true }, // Sidik jari file
    fileName: String,
    summary: String, // Hasil analisis Gemini (Teks + Deskripsi Gambar)
    uploadedBy: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Materi', materiSchema);