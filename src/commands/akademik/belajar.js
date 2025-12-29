const GeminiAi = require('../../utils/geminiHelper');
const Materi = require('../../models/Materi'); // Model Database Baru
const crypto = require('crypto');
const axios = require('axios');

module.exports = {
    name: 'belajar',
    description: 'Analisis materi kuliah dengan Smart Caching (Hemat Kuota)',
    async execute(message, args) {
        const attachment = message.attachments.first();
        const pertanyaan = args.join(' ');

        // 1. Validasi Input
        if (!attachment) return message.reply('⚠️ Lampirkan file materi (PDF/PPT/Gambar).');
        if (!pertanyaan) return message.reply('❌ Mau tanya apa?');

        const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!supportedTypes.includes(attachment.contentType)) {
            return message.reply('❌ Format tidak didukung. Gunakan PDF atau Foto.');
        }

        await message.channel.sendTyping();
        const loadingMsg = await message.reply('🔍 Memeriksa database materi...');

        try {
            // 2. Download File ke Buffer
            const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);

            // 3. HITUNG HASH (SIDIK JARI FILE)
            // Ini untuk mengecek apakah file ini sudah pernah diproses sebelumnya
            const fileHash = crypto.createHash('md5').update(buffer).digest('hex');

            // 4. CEK DATABASE (Smart Cache)
            let materiData = await Materi.findOne({ fileHash });
            let konteksJawaban = "";

            if (materiData) {
                // --- JALUR HEMAT (CACHE HIT) ---
                console.log(`[CACHE HIT] File ${attachment.name} sudah ada di DB.`);
                await loadingMsg.edit('📚 Materi ini sudah pernah saya pelajari! Mengambil data dari ingatan...');
                konteksJawaban = materiData.summary;

            } else {
                // --- JALUR PROSES BARU (CACHE MISS) ---
                console.log(`[CACHE MISS] File ${attachment.name} baru. Memproses dengan Gemini Vision...`);
                await loadingMsg.edit('🧠 Materi baru terdeteksi. Sedang menganalisis visual & teks (Proses ini butuh waktu agak lama)...');

                // Prompt khusus untuk "Ekstraksi Materi"
                // Kita suruh Gemini mendeskripsikan segalanya agar tersimpan di DB
                const promptEkstraksi = `
                Analisis dokumen materi kuliah ini secara menyeluruh.
                Tujuan: Membuat ringkasan detail yang bisa digunakan untuk menjawab pertanyaan mahasiswa di masa depan tanpa melihat file aslinya lagi.

                Lakukan:
                1. Ringkas poin-poin utama teks.
                2. JIKA ADA GAMBAR/DIAGRAM: Deskripsikan dengan detail apa yang ada di gambar tersebut (misal: "Gambar rontgen menunjukkan radiolusen di regio periapikal 46").
                3. Jangan lewatkan istilah medis penting.
                `;

                // Panggil Gemini Vision (Mahal di awal, tapi cuma sekali seumur hidup file)
                const hasilAnalisis = await GeminiAi.run(
                    message.author.id, 
                    message.author.username, 
                    promptEkstraksi, 
                    attachment.url, 
                    attachment.contentType
                );

                // SIMPAN KE DATABASE (Agar besok ga perlu proses lagi)
                await Materi.create({
                    fileHash: fileHash,
                    fileName: attachment.name,
                    summary: hasilAnalisis,
                    uploadedBy: message.author.username
                });

                konteksJawaban = hasilAnalisis;
            }

            // 5. JAWAB PERTANYAAN USER (Berdasarkan Konteks)
            // Sekarang kita tanya Gemini lagi, tapi HANYA pakai TEKS (Sangat Murah & Cepat)
            await loadingMsg.edit('✅ Menyusun jawaban...');

            const promptFinal = `
            Berikut adalah isi materi kuliah yang sudah dipelajari:
            ====================
            ${konteksJawaban.substring(0, 50000)} ... [Isi Materi]
            ====================
            
            Jawab pertanyaan user: "${pertanyaan}"
            
            Gunakan HANYA informasi dari materi di atas.
            `;

            // Kita panggil Gemini mode teks biasa (tanpa lampiran gambar)
            // Karena "gambaran" visualnya sudah terkonversi jadi teks di variabel 'konteksJawaban'
            const jawabanFinal = await GeminiAi.run(
                message.author.id, 
                message.author.username, 
                promptFinal
            );

            // Kirim
            if (jawabanFinal.length > 1900) {
                const chunks = jawabanFinal.match(/[\s\S]{1,1900}/g) || [];
                for (const chunk of chunks) await message.channel.send(chunk);
            } else {
                await message.reply(jawabanFinal);
            }

        } catch (error) {
            console.error(error);
            await loadingMsg.edit('❌ Gagal memproses. Pastikan file tidak rusak.');
        }
    },
};