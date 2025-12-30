const { MilvusClient, DataType } = require("@zilliz/milvus2-sdk-node");
const { GoogleGenerativeAI } = require("@google/genai"); // Library Google GenAI terbaru
require("dotenv").config();

// Setup Client Milvus
const milvusClient = new MilvusClient({
    address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`, 
    // token: "root:Milvus" // Jika pakai password, uncomment ini
});

// Setup Client Google untuk Embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function searchSkripsi(queryText) {
    try {
        // 1. Generate Embedding dari Query User
        // PENTING: Model embedding HARUS SAMA dengan yang dipakai saat memasukkan data ke Milvus.
        // Biasanya pasangan Gemini Flash adalah "text-embedding-004".
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        
        const result = await model.embedContent(queryText);
        const queryVector = result.embedding.values;

        // 2. Search di Milvus
        // Kita cari Top 5 skripsi yang paling relevan
        const searchResult = await milvusClient.search({
            collection_name: process.env.MILVUS_COLLECTION,
            vector: queryVector,
            limit: 5, // Ambil 5 referensi teratas
            output_fields: ["title", "specialization", "abstract", "authors", "year", "url"], // Field yang mau diambil
            consistency_level: "Strong",
        });

        if (searchResult.results.length === 0) {
            return null;
        }

        // 3. Format Hasil
        return searchResult.results;

    } catch (error) {
        console.error("❌ Milvus Error:", error);
        throw error;
    }
}

module.exports = { searchSkripsi };