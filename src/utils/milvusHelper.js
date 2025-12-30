const { MilvusClient, DataType } = require("@zilliz/milvus2-sdk-node");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Pastikan tidak ada http:// di host
const address = `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`;
const milvusClient = new MilvusClient({ address, ssl: false });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function searchSkripsi(queryText) {
    try {
        // 1. Embedding
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(queryText);
        const queryVector = result.embedding.values;

        // 2. Search di Milvus
        const searchResult = await milvusClient.search({
            collection_name: process.env.MILVUS_COLLECTION,
            // PENTING: data harus array of arrays [[0.1, ...]] untuk single query
            data: [queryVector], 
            limit: 5,
            output_fields: ["title", "specialization", "abstract", "authors", "year", "url"],
            // PENTING: params pencarian vector
            params: { 
                metric_type: "COSINE", 
                params: JSON.stringify({ nprobe: 10 }) 
            }
        });

        if (searchResult.results.length === 0) {
            return null;
        }

        // Search result milvus biasanya membungkus result dalam property 'results'
        // Struktur balikan milvus node sdk kadang langsung array of objects tergantung versi
        return searchResult.results;

    } catch (error) {
        console.error("❌ Milvus Error:", error);
        throw error;
    }
}

module.exports = { searchSkripsi };