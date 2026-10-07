const { milvusClient } = require("./milvusClient");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { searchLocalSkripsi } = require("../../services/oaiService");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function searchSkripsi(queryText) {
    // 1. Coba cari di Milvus terlebih dahulu jika koleksi skripsi tersedia
    try {
        if (process.env.MILVUS_COLLECTION && process.env.MILVUS_COLLECTION !== "notebook_amamiya") {
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const result = await model.embedContent(queryText);
            const queryVector = result.embedding.values;

            const searchResult = await milvusClient.search({
                collection_name: process.env.MILVUS_COLLECTION,
                data: [queryVector], 
                limit: 5,
                output_fields: ["title", "specialization", "abstract", "authors", "year", "url"],
                params: { 
                    metric_type: "COSINE", 
                    params: JSON.stringify({ nprobe: 10 }) 
                }
            });

            if (searchResult?.results?.length > 0) {
                return searchResult.results;
            }
        }
    } catch (milvusErr) {
        console.warn(`⚠️ [Milvus Skripsi] Milvus query tidak tersedia (${milvusErr.message}), beralih ke cache lokal.`);
    }

    // 2. Fallback cerdas: Cari di database cache skripsi lokal (OAI 2.0 Harvester Cache)
    try {
        const localResults = searchLocalSkripsi(queryText, 5);
        if (localResults.length > 0) {
            return localResults;
        }
    } catch (localErr) {
        console.error("❌ Gagal mencari di cache skripsi lokal:", localErr.message);
    }

    return null;
}

module.exports = { searchSkripsi };