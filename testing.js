require("dotenv").config();
const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi Klien
const address = `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`;
const milvusClient = new MilvusClient({ address, ssl: false });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testSearch(queryText) {
    try {
        console.log(`\n🔍 Pertanyaan User: "${queryText}"`);

        // 1. Ubah Pertanyaan menjadi Vector Embedding
        const modelEmbed = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embedResult = await modelEmbed.embedContent(queryText);
        const queryVector = embedResult.embedding.values;

        // 2. Cari di Milvus (Koleksi: notebook_amamiya)
        const searchResult = await milvusClient.search({
            collection_name: "notebook_amamiya",
            data: [queryVector],
            limit: 3,
            output_fields: ["text_content", "page_number"],
            params: { 
                metric_type: "COSINE", 
                params: JSON.stringify({ nprobe: 10 }) 
            }
        });

        if (!searchResult.results || searchResult.results.length === 0) {
            console.log("❌ Tidak ditemukan materi yang relevan.");
            return;
        }

        // 3. Kirim hasil penelusuran ke Gemini untuk dirangkum
        console.log("\n🤖 Amamiya sedang membaca referensi dan menyusun jawaban...");
        const answer = await generateAnswer(queryText, searchResult.results);

        console.log("\n✨ JAWABAN AMAMIYA:");
        console.log("==================================================");
        console.log(answer);
        console.log("==================================================");

    } catch (error) {
        console.error("❌ Terjadi kesalahan:", error);
    } finally {
        milvusClient.closeConnection();
    }
}

async function generateAnswer(query, contextChunks) {
    const modelFlash = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Format konteks agar AI tahu asal halamannya
    const contextText = contextChunks
        .map(c => `[Halaman ${c.page_number}]: ${c.text_content}`)
        .join("\n\n");

    const prompt = `
    Kamu adalah Amamiya, asisten pintar dari FKG Universitas Sriwijaya.
    Gunakan referensi materi di bawah ini untuk menjawab pertanyaan mahasiswa secara jujur dan tegas.
    
    REFERENSI MATERI:
    ${contextText}

    PERTANYAAN: 
    "${query}"

    ATURAN JAWABAN:
    1. Jawablah dengan detail dan gaya bahasa yang profesional.
    2. Sertakan nomor halaman asal informasi di akhir setiap poin atau kalimat utama.
    3. Jika jawaban tidak ada di referensi, sampaikan bahwa materi tersebut tidak ditemukan dalam catatan.
    `;

    const result = await modelFlash.generateContent(prompt);
    return result.response.text();
}

// Jalankan Pengetesan
testSearch("apa saja klasifikasi impaksi kaninus");