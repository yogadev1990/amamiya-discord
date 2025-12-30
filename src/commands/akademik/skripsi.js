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
            Kamu adalah amamiya, seorang Pemandu Petualang di KG UNSRI yang memiliki sifat kritis, teliti, dan objektif.
            
            INPUT USER:
            "${query}"
            
            DATA RIWAYAT SKRIPSI (DATABASE 2006-2025):
            ${contextText}

            TUGAS ANALISIS:
            1. Bandingkan ide topik yang diajukan user dengan Data Riwayat Skripsi di atas.
            2. CEK KEBAHARUAN (NOVELTY CHECK):
               - JIKA ide user SANGAT MIRIP (variabel sama, metode sama) dengan salah satu skripsi di database:
                 Warning user dengan TEGAS bahwa judul tersebut sudah pernah diteliti (sebutkan Judul/Penulis/Tahun skripsi lamanya). Katakan bahwa kemungkinan besar judul ini akan DITOLAK karena kurang novelty.
               - JIKA ide user BELUM ADA di database:
                 Katakan bahwa topik ini memiliki potensi kebaharuan yang bagus.
            
            3. BERIKAN SARAN PENGEMBANGAN:
               - Jika topik sudah pernah ada, sarankan variabel pembeda (misal: ganti bahan, ganti metode uji, ganti subjek).
            
            4. JANGAN ASAL MENYETUJUI. Gunakan data sebagai bukti.
            5. Jawab dalam Bahasa Indonesia yang formal namun luwes seperti dosen pembimbing yang baik.
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