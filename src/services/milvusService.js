const { GoogleGenAI } = require('@google/genai');
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
const fs = require('fs'); // <--- TAMBAHKAN INI UNTUK MEMBACA FILE
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const milvusClient = new MilvusClient({
    address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`,
    ssl: false
});

async function searchMateriKuliah(queryText) {
    try {
        console.log(`[Milvus] Memproses kueri: "${queryText}"`);

        const embedResult = await ai.models.embedContent({
            model: 'gemini-embedding-001', 
            contents: queryText
        });

        const vector = embedResult.embeddings[0].values;

        const searchRes = await milvusClient.search({
            collection_name: "notebook_amamiya",
            vector: vector,
            output_fields: ["text_content", "page_number", "image_url"],
            limit: 3 
        });

        if (searchRes.results.length === 0) {
            return { text: "Sistem tidak menemukan literatur yang relevan.", image: null };
        }

        let konteksGabungan = "Berdasarkan literatur dari database:\n";
        let gambarDitemukan = null; 

        searchRes.results.forEach(r => {
            konteksGabungan += `[Hal ${r.page_number}]: ${r.text_content}\n`;
            
            // --- LOGIKA BASE64 DARI KODE LAMA ANDA ---
            if (r.image_url && !gambarDitemukan && fs.existsSync(r.image_url)) {
                try {
                    const imgBuffer = fs.readFileSync(r.image_url);
                    // Format langsung menjadi Data URI agar Three.js bisa langsung membacanya
                    gambarDitemukan = `data:image/png;base64,${imgBuffer.toString('base64')}`;
                } catch (err) {
                    console.error("Gagal membaca file gambar dari storage:", err);
                }
            }
        });

        console.log(`[Milvus] Pencarian selesai. Gambar dikirim: ${gambarDitemukan ? 'Ya (Base64)' : 'Tidak'}`);
        
        return { 
            text: konteksGabungan, 
            image: gambarDitemukan 
        };
    } catch (error) {
        console.error("❌ [Milvus] ERROR:", error);
        return { text: "Terjadi kesalahan internal pada database.", image: null };
    }
}

module.exports = { searchMateriKuliah };