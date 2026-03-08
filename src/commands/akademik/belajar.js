require("dotenv").config();
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFParse } = require('pdf-parse');
const axios = require('axios');
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { fromPath } = require("pdf2pic");

// Database Models (Asumsi tetap dipakai untuk manajemen profil & state buku)
const User = require('../../models/User');
const Notebook = require('../../models/Notebook');

// --- KONFIGURASI ---
const STORAGE_PATH = "/materi"; // Menggunakan volume mount
const milvusClient = new MilvusClient({ address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`, ssl: false });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Pastikan direktori storage ada
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

function chunkTextSemantic(text, maxChars = 1200, overlapChars = 200) {
    if (!text) throw new Error("Invalid input: text is undefined or null.");
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const sentences = cleanText.split(/(?<=\.)\s+/);
    
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxChars) {
            chunks.push(currentChunk.trim());
            currentChunk = currentChunk.slice(-overlapChars) + " " + sentence; 
        } else {
            currentChunk += sentence + " ";
        }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    return chunks;
}

async function isImageEducational(imageBuffer, mimeType = "image/png") {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = "Analisis gambar ini. Apakah ini adalah materi edukasi medis/akademik (seperti rontgen radiografi, diagram anatomi, grafik data, atau slide berisi teks penting) ATAU hanya gambar hiasan? Jawab HANYA dengan kata 'MATERI' atau 'HIASAN'.";
        const imageParts = [{ inlineData: { data: imageBuffer.toString("base64"), mimeType } }];
        const result = await model.generateContent([prompt, ...imageParts]);
        return result.response.text().trim().toUpperCase().includes("MATERI");
    } catch (error) {
        console.error("[CLASSIFIER] Gagal mengklasifikasi gambar:", error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sinau')
        .setDescription('Sistem sinau cerdas ala NotebookLM')
        .addSubcommand(subcommand =>
            subcommand.setName('buat')
                .setDescription('Buat buku catatan baru')
                .addStringOption(option => option.setName('nama').setDescription('Nama buku catatan').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('buka')
                .setDescription('Buka buku catatan yang ada')
                .addStringOption(option => option.setName('nama').setDescription('Nama buku catatan').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('unggah')
                .setDescription('Unggah materi (PDF) ke buku aktif')
                .addAttachmentOption(option => option.setName('file').setDescription('File materi PDF').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('tanya')
                .setDescription('Tanya AI berdasarkan isi buku')
                .addStringOption(option => option.setName('soal').setDescription('Pertanyaan kamu').setRequired(true))),

    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();
        await interaction.deferReply(); // Mencegah timeout karena proses AI butuh waktu

        // 1. Pastikan profil user ada di database
        let userProfile = await User.findOne({ userId: interaction.user.id });
        if (!userProfile) {
            userProfile = await User.create({ userId: interaction.user.id, username: interaction.user.username });
        }

        // ==========================================
        // FITUR 1: BUAT NOTEBOOK BARU
        // ==========================================
        if (subCommand === 'buat') {
            const namaBuku = interaction.options.getString('nama');
            const cekJudul = await Notebook.findOne({ ownerId: interaction.user.id, namaNotebook: namaBuku });
            
            if (cekJudul) return interaction.editReply('⚠️ Kamu sudah punya buku catatan dengan nama tersebut!');

            await Notebook.create({ ownerId: interaction.user.id, namaNotebook: namaBuku });
            return interaction.editReply(`✅ Buku catatan **"${namaBuku}"** berhasil diciptakan! Gunakan perintah \`/sinau buka nama:${namaBuku}\` untuk menggunakannya.`);
        }

        // ==========================================
        // FITUR 2: BUKA NOTEBOOK
        // ==========================================
        if (subCommand === 'buka') {
            const namaBuku = interaction.options.getString('nama');
            const targetNotebook = await Notebook.findOne({ ownerId: interaction.user.id, namaNotebook: namaBuku });
            
            if (!targetNotebook) return interaction.editReply('❌ Buku catatan tidak ditemukan.');

            userProfile.activeNotebook = targetNotebook._id;
            await userProfile.save();
            return interaction.editReply(`📂 Buku catatan **"${targetNotebook.namaNotebook}"** sekarang aktif. Kamu bisa mulai unggah file atau tanya materi.`);
        }

        // ==========================================
        // FITUR 3: UNGGAH MATERI (PDF ke Milvus)
        // ==========================================
        if (subCommand === 'unggah') {
            if (!userProfile.activeNotebook) return interaction.editReply('⚠️ Buka buku catatan dulu! Contoh: `/sinau buka nama:Anatomi Kepala`');
            
            const attachment = interaction.options.getAttachment('file');
            if (attachment.contentType !== 'application/pdf') return interaction.editReply('❌ Saat ini hanya format PDF yang didukung untuk ekstraksi mendalam.');

            try {
                // Unduh file ke storage S3 (/materi)
                const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);
                const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
                const filePath = path.join(STORAGE_PATH, `${fileHash}.pdf`);
                
                fs.writeFileSync(filePath, buffer);

                const activeNotebook = await Notebook.findById(userProfile.activeNotebook);
                if (activeNotebook.files.some(f => f.fileHash === fileHash)) {
                    fs.unlinkSync(filePath); // Hapus jika sudah ada
                    return interaction.editReply('⚠️ File ini sudah ada di dalam buku catatan aktifmu.');
                }

                await interaction.editReply(`🔍 Memproses **${attachment.name}**... Mengekstrak teks & visual (ini memakan waktu).`);

                // --- PROSES EKSTRAKSI (Diadaptasi dari testIngestPDF) ---
                const parser = new PDFParse({ data: buffer });
                const infoResult = await parser.getInfo();
                const totalPages = infoResult.total || 1;
                const textResult = await parser.getText();
                const rawText = textResult.text || "";
                await parser.destroy();

                const textChunks = rawText.trim() ? chunkTextSemantic(rawText, 1000, 200) : [];
                const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const milvusData = [];

                // Vektorisasi Teks
                for (let i = 0; i < textChunks.length; i++) {
                    if (textChunks[i].length < 50) continue; 
                    const result = await embedModel.embedContent(textChunks[i]);
                    milvusData.push({
                        fileHash: fileHash,
                        text_content: textChunks[i],
                        embedding: result.embedding.values,
                        page_number: Math.ceil(((i + 1) / textChunks.length) * totalPages), 
                        image_url: ""
                    });
                    await new Promise(res => setTimeout(res, 200)); // Rate limit
                }

                // Vektorisasi Visual
                const options = { density: 150, saveFilename: `img_${fileHash}`, savePath: STORAGE_PATH, format: "png", width: 1024, height: 1024 };
                const storeAsImage = fromPath(filePath, options);

                for (let page = 1; page <= totalPages; page++) {
                    try {
                        const pageImage = await storeAsImage(page);
                        const imageBuffer = fs.readFileSync(pageImage.path);
                        const isMateri = await isImageEducational(imageBuffer);
                        
                        if (isMateri) {
                            const promptDeskripsi = "Deskripsikan detail penting dari gambar medis/akademik ini secara komprehensif agar bisa dipahami tanpa melihat gambarnya.";
                            const imageParts = [{ inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/png" } }];
                            const deskripsiResult = await visionModel.generateContent([promptDeskripsi, ...imageParts]);
                            const teksDeskripsi = `[DESKRIPSI VISUAL HALAMAN ${page}]: ` + deskripsiResult.response.text();

                            const vectorResult = await embedModel.embedContent(teksDeskripsi);
                            milvusData.push({
                                fileHash: fileHash,
                                text_content: teksDeskripsi,
                                embedding: vectorResult.embedding.values,
                                page_number: page,
                                image_url: pageImage.path 
                            });
                        } else {
                            fs.unlinkSync(pageImage.path); // Hapus hiasan
                        }
                        await new Promise(res => setTimeout(res, 1000));
                    } catch (imgErr) {
                        console.error(`Gagal memproses visual halaman ${page}:`, imgErr.message);
                    }
                }

                // Injeksi ke Milvus
                if (milvusData.length > 0) {
                    await milvusClient.insert({ collection_name: "notebook_amamiya", fields_data: milvusData });
                    await milvusClient.flushSync({ collection_names: ["notebook_amamiya"] });
                }

                // Simpan referensi ke MongoDB Notebook
                activeNotebook.files.push({ fileHash: fileHash, fileName: attachment.name });
                await activeNotebook.save();

                // Bersihkan file PDF lokal jika tidak diperlukan lagi untuk menghemat S3
                fs.unlinkSync(filePath);

                return interaction.editReply(`✅ Sukses! **${attachment.name}** berhasil diproses (${textChunks.length} teks, ${milvusData.filter(d => d.image_url !== "").length} visual) dan ditambahkan ke **"${activeNotebook.namaNotebook}"**.`);

            } catch (err) {
                console.error(err);
                return interaction.editReply('❌ Gagal memproses file. Pastikan file tidak korup atau sistem sedang kelebihan beban.');
            }
        }

        // ==========================================
        // FITUR 4: TANYA (Pencarian Vektor Milvus)
        // ==========================================
        if (subCommand === 'tanya') {
            if (!userProfile.activeNotebook) return interaction.editReply('⚠️ Buka buku catatan dulu!');
            
            const pertanyaan = interaction.options.getString('soal');
            const activeNotebook = await Notebook.findById(userProfile.activeNotebook);
            
            if (activeNotebook.files.length === 0) return interaction.editReply('⚠️ Buku catatanmu masih kosong. Gunakan `/belajar unggah` dulu.');

            try {
                const hashes = activeNotebook.files.map(f => f.fileHash);
                const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                
                // 1. Ubah pertanyaan jadi vektor
                const queryEmbed = await embedModel.embedContent(pertanyaan);

                // 2. Cari di Milvus dan minta output tambahan: fileHash & image_url
                const hashFilter = `fileHash in [${hashes.map(h => `"${h}"`).join(',')}]`;
                const searchRes = await milvusClient.search({
                    collection_name: "notebook_amamiya",
                    vector: queryEmbed.embedding.values,
                    filter: hashFilter,
                    output_fields: ["text_content", "page_number", "fileHash", "image_url"],
                    limit: 5 // Ambil 5 konteks paling relevan
                });

                if (searchRes.results.length === 0) {
                    return interaction.editReply('Materi relevan tidak ditemukan di dalam buku ini.');
                }

                // 3. Map untuk mencocokkan fileHash dari Milvus dengan fileName dari MongoDB
                const hashToNameMap = {};
                activeNotebook.files.forEach(f => {
                    hashToNameMap[f.fileHash] = f.fileName;
                });

                // 4. Ekstrak Konteks, Referensi, dan Gambar
                let konteksGabungan = "";
                let mapReferensi = new Map(); // Menggunakan Map untuk mengelompokkan file
                let lampiranGambar = [];

                searchRes.results.forEach((res) => {
                    const fileName = hashToNameMap[res.fileHash] || "Dokumen Tidak Diketahui";
                    
                    // Susun konteks untuk AI
                    konteksGabungan += `[Dokumen: ${fileName} | Hal: ${res.page_number}]\n${res.text_content}\n\n`;

                    // Kelompokkan halaman berdasarkan fileHash agar tidak ada duplikasi nama file
                    if (!mapReferensi.has(res.fileHash)) {
                        mapReferensi.set(res.fileHash, {
                            fileName: fileName,
                            pages: new Set([res.page_number])
                        });
                    } else {
                        mapReferensi.get(res.fileHash).pages.add(res.page_number);
                    }

                    // Cek dan siapkan lampiran gambar
                    if (res.image_url && res.image_url.trim() !== "" && fs.existsSync(res.image_url)) {
                        const namaGambar = path.basename(res.image_url);
                        if (!lampiranGambar.some(lampiran => lampiran.name === namaGambar)) {
                            lampiranGambar.push(new AttachmentBuilder(res.image_url, { name: namaGambar }));
                        }
                    }
                });

                // Batasi jumlah lampiran maksimal 10
                if (lampiranGambar.length > 10) lampiranGambar = lampiranGambar.slice(0, 10);

                // 5. Prompting ke Gemini dengan aturan penyebutan sumber yang lebih natural
                const promptFinal = `
                Berikut adalah potongan informasi dari buku catatan pengguna:
                ====================
                ${konteksGabungan}
                ====================
                Jawab pertanyaan ini dengan presisi tinggi: "${pertanyaan}"
                
                Aturan Mutlak:
                1. Jawab HANYA berdasarkan informasi di atas.
                2. Buat penjelasan mengalir secara natural dan mudah dibaca.
                3. JANGAN mengulang sumber yang sama di setiap baris/poin. Jika sebuah paragraf atau daftar berasal dari sumber dan halaman yang sama, cukup tuliskan sitasinya satu kali di akhir paragraf/daftar tersebut (Format: [Nama File, Hal X, Y]).
                4. Jika informasi tidak cukup, nyatakan dengan tegas bahwa dokumen tidak mencakup jawaban tersebut.
                `;

                const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
                const jawabanFinal = await chatModel.generateContent(promptFinal);
                let teksJawaban = jawabanFinal.response.text();

                // 6. Susun daftar referensi yang sudah rapi
                let teksDaftarReferensi = "";
                mapReferensi.forEach((data, hash) => {
                    // Urutkan halaman dari terkecil ke terbesar
                    const listHalaman = Array.from(data.pages).sort((a, b) => a - b).join(', ');
                    const fileLink = `https://is3.cloudhost.id/libraryrevanda/materi/${hash}.pdf`;
                    teksDaftarReferensi += `📄 **${data.fileName}** (Hal: ${listHalaman}) - [Buka PDF](${fileLink})\n`;
                });

                let finalOutput = `${teksJawaban}\n\n**📚 Sumber Referensi yang Dipakai:**\n${teksDaftarReferensi}`;

                // 6. Pengiriman ke Discord (Handling limit 2000 karakter)
                if (finalOutput.length > 1900) {
                    const chunks = finalOutput.match(/[\s\S]{1,1900}/g) || [];
                    // Kirim teks pertama
                    await interaction.editReply({ content: chunks[0] });
                    // Kirim sisa teks berturut-turut
                    for (let i = 1; i < chunks.length - 1; i++) {
                        await interaction.followUp({ content: chunks[i] });
                    }
                    // Kirim teks terakhir beserta gambar jika ada
                    await interaction.followUp({ content: chunks[chunks.length - 1], files: lampiranGambar });
                } else {
                    // Kirim jawaban sekaligus dengan gambar
                    return interaction.editReply({ content: finalOutput, files: lampiranGambar });
                }

            } catch (err) {
                console.error(err);
                return interaction.editReply('❌ Terjadi kesalahan saat memproses jawaban dari basis data vektor.');
            }
        }
    },
};