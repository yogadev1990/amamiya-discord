// --- 1. UBAH IMPORT MENJADI REQUIRE ---
const { GoogleGenAI } = require('@google/genai');
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
require('dotenv').config();

// Inisialisasi AI untuk membuat Vektor/Embedding
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Inisialisasi Koneksi Database Milvus
const milvusClient = new MilvusClient({
    address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`,
    ssl: false
});

// --- 2. HAPUS 'export' DARI DEKLARASI FUNGSI ---
async function searchMateriKuliah(queryText) {
    try {
        console.log(`[Milvus] Memproses kueri: "${queryText}"`);

        const embedResult = await ai.models.embedContent({
            model: 'gemini-embedding-001', 
            contents: queryText
        });

        const vector = embedResult.embeddings[0].values;

        // Cari kedekatan vektor di Milvus
        const searchRes = await milvusClient.search({
            collection_name: "notebook_amamiya",
            vector: vector,
            output_fields: ["text_content", "page_number", "image_url"],
            limit: 3 
        });

        // 3. PERBAIKAN FATAL: Kembalikan Object, bukan String!
        if (searchRes.results.length === 0) {
            console.log("[Milvus] Tidak ada data yang relevan ditemukan.");
            return { 
                text: "Sistem tidak menemukan literatur yang relevan di dalam database.", 
                image: null 
            };
        }

        let konteksGabungan = "Berdasarkan literatur dari database:\n";
        let gambarDitemukan = null; // Variabel penyimpan gambar

        searchRes.results.forEach(r => {
            konteksGabungan += `[Hal ${r.page_number}]: ${r.text_content}\n`;
            
            // Tangkap URL gambar pertama yang tersedia dari hasil pencarian
            if (r.image_url && !gambarDitemukan) {
                gambarDitemukan = r.image_url;
            }
        });

        console.log(`[Milvus] Pencarian selesai. Gambar ditemukan: ${gambarDitemukan ? 'Ya' : 'Tidak'}`);
        
        // Kembalikan sebagai object
        return { 
            text: konteksGabungan, 
            image: gambarDitemukan 
        };
    } catch (error) {
        console.error("❌ [Milvus] ERROR:", error);
        // PERBAIKAN FATAL: Kembalikan Object saat Error!
        return { 
            text: "Terjadi kesalahan internal saat mencoba mengakses database materi.", 
            image: null 
        };
    }
}

// --- 4. WAJIB: EKSPOR SEBAGAI MODULE.EXPORTS ---
module.exports = { searchMateriKuliah };