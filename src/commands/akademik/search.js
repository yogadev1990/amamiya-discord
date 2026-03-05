const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Cari info umum (lomba, beasiswa, dll) di internet secara real-time')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Kata kunci pencarian (contoh: beasiswa kedokteran 2025)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString('query');

        // Wajib deferReply karena proses Google API + Gemini AI butuh waktu > 3 detik
        await interaction.deferReply();

        try {
            // 1. GOOGLING (Hit Google Custom Search API)
            const googleUrl = `https://www.googleapis.com/customsearch/v1`;
            const params = {
                key: process.env.GOOGLE_SEARCH_KEY,
                cx: process.env.GOOGLE_CX,
                q: query,
                num: 6,
                gl: 'id',
                hl: 'id'
            };

            const response = await axios.get(googleUrl, { params });
            const items = response.data.items;

            if (!items || items.length === 0) {
                return interaction.editReply('❌ Tidak ditemukan info yang relevan di Google.');
            }

            // 2. RAPIKAN HASIL
            let searchContext = "Hasil Pencarian Google:\n";
            items.forEach((item, index) => {
                searchContext += `${index + 1}. Judul: ${item.title}\n   Link: ${item.link}\n   Snippet: ${item.snippet}\n\n`;
            });

            // 3. ANALISIS AI
            const prompt = `
            User mencari info: "${query}".
            
            Berikut adalah hasil pencarian Google mentah:
            ================
            ${searchContext}
            ================

            Tugasmu:
            1. Pilihlah 3-5 info yang PALING RELEVAN dan TERBARU (Pastikan tahunnya valid/mendekati saat ini).
            2. Buat rangkuman singkat untuk setiap info.
            3. Sertakan Link-nya.
            4. Format outputmu seperti ini:
               
               **[Judul Info](Link)**
               🗓️ *Indikasi Waktu/Deadline (jika ada di snippet)*
               📝 Ringkasan singkat...
               
            5. Jika semua hasil terlihat kadaluarsa/tahun lama, katakan "Maaf, belum ada info terbaru yang valid."
            `;

            const hasilAI = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);

            // 4. KIRIM KE DISCORD
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`🔎 Hasil Pencarian: ${query}`)
                .setDescription(hasilAI)
                .setFooter({ text: 'Data diambil secara real-time dari Google Search & Dianalisis oleh AI' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Lihat di Google')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error("Search Command Error:", error);
            
            if (error.response && error.response.status === 429) {
                return interaction.editReply('⚠️ Kuota pencarian harian bot habis (Limit Google). Coba lagi besok.');
            }
            
            await interaction.editReply('❌ Terjadi kesalahan saat mencari info. Pastikan API Key valid atau coba beberapa saat lagi.');
        }
    },
};