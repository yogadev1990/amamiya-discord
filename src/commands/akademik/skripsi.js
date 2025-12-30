const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { searchSkripsi } = require('../../utils/milvusHelper');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'skripsi',
    description: 'Cari referensi skripsi FKG Unsri (2006-2025) via Milvus Database',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Mau cari skripsi tentang apa? Contoh: `!skripsi pengaruh obat kumur terhadap plak`');
        }

        const query = args.join(' ');
        await message.channel.sendTyping();
        const loadingMsg = await message.reply('🔍 Sedang mencari di database skripsi Unsri...');

        try {
            // 1. CARI DI MILVUS (RAG Retrieval)
            const results = await searchSkripsi(query);

            if (!results || results.length === 0) {
                return loadingMsg.edit('❌ Tidak ditemukan skripsi yang relevan dengan topik tersebut.');
            }

            // 2. SUSUN KONTEKS (Context Construction)
            // Kita rangkai data dari Milvus jadi teks yang bisa dibaca Gemini
            let contextText = "";
            results.forEach((doc, index) => {
                contextText += `
                [Dokumen ${index + 1}]
                Judul: ${doc.judul}
                Penulis: ${doc.penulis} (${doc.tahun})
                Link: ${doc.link}
                Abstrak: ${doc.abstrak}
                -----------------------------------`;
            });

            // 3. GENERATE JAWABAN DENGAN GEMINI (Generation)
            const prompt = `
            User mencari referensi skripsi dengan topik: "${query}"
            
            Berikut adalah data skripsi FKG Unsri terdahulu yang ditemukan dari Database Vector (Milvus):
            ${contextText}

            Instruksi:
            1. Jawab pertanyaan user berdasarkan data di atas.
            2. Rangkumkan poin-poin penting dari skripsi-skripsi tersebut yang relevan dengan topik user.
            3. Sebutkan Judul, Penulis, dan Tahun saat mengutip.
            4. Berikan kesimpulan singkat tren penelitian topik tersebut di Unsri.
            5. JANGAN mengarang data. Gunakan hanya data yang disediakan.
            6. Sertakan Link skripsi di akhir setiap poin jika ada.
            `;

            const jawabanAI = await GeminiAi.run(message.author.id, message.author.username, prompt);

            // 4. KIRIM HASIL KE DISCORD
            // Kita pecah pesan kalau kepanjangan, dan kasih tombol link skripsi pertama
            
            // Siapkan tombol link untuk dokumen #1 (Paling relevan)
            const topResult = results[0];
            const row = new ActionRowBuilder();
            
            if (topResult.link && topResult.link.startsWith('http')) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('📖 Baca Skripsi Terkait #1')
                        .setStyle(ButtonStyle.Link)
                        .setURL(topResult.link)
                );
            }

            // Edit pesan loading jadi hasil
            // Cek panjang karakter discord (max 2000)
            if (jawabanAI.length > 1900) {
                const chunks = jawabanAI.match(/[\s\S]{1,1900}/g) || [];
                await loadingMsg.edit(`📚 **Hasil Penelusuran Skripsi FKG Unsri:**`);
                for (const chunk of chunks) {
                    await message.channel.send({ content: chunk });
                }
                // Kirim tombol di pesan terpisah terakhir
                if (row.components.length > 0) await message.channel.send({ components: [row] });
            } else {
                await loadingMsg.edit({ 
                    content: `📚 **Hasil Penelusuran Skripsi FKG Unsri:**\n\n${jawabanAI}`,
                    components: row.components.length > 0 ? [row] : []
                });
            }

        } catch (error) {
            console.error(error);
            await loadingMsg.edit('❌ Terjadi kesalahan saat mengakses Database Milvus.');
        }
    },
};