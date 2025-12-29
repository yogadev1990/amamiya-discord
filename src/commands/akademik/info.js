const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'info',
    description: 'Cari info lomba, beasiswa, atau seminar terbaru secara real-time',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Mau cari info apa? Contoh:\n`!info lomba poster kedokteran 2025`\n`!info beasiswa s1 kedokteran gigi`');
        }

        const query = args.join(' ');
        await message.channel.sendTyping();

        try {
            // 1. GOOGLING (Hit Google Custom Search API)
            // Dokumentasi: https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
            const googleUrl = `https://www.googleapis.com/customsearch/v1`;
            const params = {
                key: process.env.GOOGLE_SEARCH_KEY,
                cx: process.env.GOOGLE_CX,
                q: query, // Kata kunci dari user
                num: 6,   // Ambil 6 hasil teratas
                gl: 'id', // Region Indonesia
                hl: 'id'  // Bahasa Indonesia
            };

            const response = await axios.get(googleUrl, { params });
            const items = response.data.items;

            if (!items || items.length === 0) {
                return message.reply('❌ Tidak ditemukan info yang relevan di Google.');
            }

            // 2. RAPIKAN HASIL (Parsing)
            // Kita susun data mentah Google jadi string biar Gemini bisa baca
            let searchContext = "Hasil Pencarian Google:\n";
            items.forEach((item, index) => {
                searchContext += `${index + 1}. Judul: ${item.title}\n   Link: ${item.link}\n   Snippet: ${item.snippet}\n\n`;
            });

            // 3. ANALISIS AI (Minta Gemini memfilter yang basi)
            // Kadang Google menampilkan hasil 2023. Kita suruh Gemini membuangnya.
            const prompt = `
            User mencari info: "${query}".
            
            Berikut adalah hasil pencarian Google mentah:
            ================
            ${searchContext}
            ================

            Tugasmu:
            1. Pilihlah 3-5 info yang PALING RELEVAN dan TERBARU (Pastikan tahunnya valid/mendukati saat ini).
            2. Buat rangkuman singkat untuk setiap info.
            3. Sertakan Link-nya.
            4. Format outputmu seperti ini:
               
               **[Judul Info](Link)**
               🗓️ *Indikasi Waktu/Deadline (jika ada di snippet)*
               📝 Ringkasan singkat...
               
            5. Jika semua hasil terlihat kadaluarsa/tahun lama, katakan "Maaf, belum ada info terbaru yang valid."
            `;

            // Panggil Gemini (Mode Teks Biasa)
            const hasilAI = await GeminiAi.run(message.author.id, message.author.username, prompt);

            // 4. KIRIM KE DISCORD
            const embed = new EmbedBuilder()
                .setColor(0xFFA500) // Warna Oranye
                .setTitle(`🔎 Hasil Pencarian: ${query}`)
                .setDescription(hasilAI)
                .setFooter({ text: 'Data diambil secara real-time dari Google Search' });

            // Tambahkan tombol ke Google langsung (opsional)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Lihat di Google')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://www.google.com/search?q=${encodeURIComponent(query)}`)
            );

            await message.reply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(error);
            // Error handling khusus jika kuota Google habis
            if (error.response && error.response.status === 429) {
                return message.reply('⚠️ Kuota pencarian harian bot habis (Limit Google). Coba lagi besok atau gunakan `!jurnal`.');
            }
            message.reply('❌ Terjadi kesalahan saat mencari info.');
        }
    },
};