const mongoose = require('mongoose');

const notebookSchema = new mongoose.Schema({
    ownerId: { type: String, required: true, index: true }, // ID Discord Mahasiswa
    namaNotebook: { type: String, required: true }, // Cth: "Proposal Skripsi Rontgen"
    
    // Daftar referensi ke fileHash yang ada di Materi.js
    files: [
        {
            fileHash: { type: String, required: true }, 
            fileName: { type: String, required: true }, 
            addedAt: { type: Date, default: Date.now }
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notebook', notebookSchema);