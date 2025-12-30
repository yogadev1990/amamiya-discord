const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { searchSkripsi } = require('../../utils/milvusHelper');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'skripsi',
    description: 'Cari referensi skripsi FKG Unsri via Milvus',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Mau cari skripsi tentang apa? Contoh: `!skripsi karies gigi anak`');
        }

        const query = args.join(' ');
        // Gunakan reply agar men-tag user, bukan sendTyping biasa
        const loadingMsg = await message.reply('🔍 Sedang mencari di database skripsi Unsri...');

        try {
            const results = await searchSkripsi(query);

            if (!results || results.length === 0) {
                return loadingMsg.edit('❌ Tidak ditemukan skripsi yang relevan.');
            }

            // --- OPTIMASI 1: Bersihkan Data & Mapping Field ---
            let contextText = "";
            results.forEach((doc, index) => {
                // BUG FIX: Sesuaikan nama field dengan Schema Milvus (title, authors, url)
                // Safety check: (doc.abstract || "").substring(...) mencegah error jika abstrak null
                contextText += `
                [Dokumen ${index + 1}]
                Judul: ${doc.title}
                Penulis: ${doc.authors} (${doc.year})
                Departemen: ${doc.specialization}
                Link: ${doc.url}
                Abstrak Singkat: ${(doc.abstract || "").substring(0, 300)}... 
                -----------------------------------`;
            });

            // --- OPTIMASI 2: Prompt Engineering ---
            const prompt = `
            Bertindaklah sebagai Asisten Akademik FKG UNSRI.
            Pertanyaan User: "${query}"
            
            Data Referensi (Ditemukan di Database Internal):
            ${contextText}

            Tugas:
            1. Jawab pertanyaan user dengan mensintesis informasi dari referensi di atas.
            2. Jika relevan, kutip Judul dan Penulis (Tahun).
            3. Berikan kesimpulan singkat.
            4. Jika tidak ada info di data yang menjawab pertanyaan, katakan sejujurnya.
            `;

            const jawabanAI = await GeminiAi.run(message.author.id, message.author.username, prompt);

            // --- OPTIMASI 3: Button Handling ---
            // Ambil link dari hasil teratas (score tertinggi)
            const topResult = results[0];
            const row = new ActionRowBuilder();
            
            // Validasi URL valid sebelum bikin tombol
            if (topResult.url && topResult.url.startsWith('http')) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('📖 Baca Skripsi Teratas')
                        .setStyle(ButtonStyle.Link)
                        .setURL(topResult.url)
                );
            }

            // Split message logic (tetap dipertahankan)
            if (jawabanAI.length > 1900) {
                const chunks = jawabanAI.match(/[\s\S]{1,1900}/g) || [];
                await loadingMsg.edit(`📚 **Hasil Penelusuran:**`);
                for (const chunk of chunks) {
                    await message.channel.send({ content: chunk });
                }
                if (row.components.length > 0) await message.channel.send({ components: [row] });
            } else {
                await loadingMsg.edit({ 
                    content: `📚 **Hasil Penelusuran:**\n\n${jawabanAI}`,
                    components: row.components.length > 0 ? [row] : []
                });
            }

        } catch (error) {
            console.error(error);
            // Cek jika loadingMsg masih ada/bisa diedit
            if (loadingMsg.editable) {
                await loadingMsg.edit('❌ Terjadi kesalahan sistem (Database/AI Error).');
            }
        }
    },
};