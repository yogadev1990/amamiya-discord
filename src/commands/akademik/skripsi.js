const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { searchSkripsi } = require('../../utils/milvusHelper');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skripsi')
        .setDescription('Cari referensi dan cek kebaharuan skripsi FKG Unsri via Milvus')
        .addStringOption(option =>
            option.setName('topik')
                .setDescription('Ide judul atau topik skripsi (contoh: karies gigi anak)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const query = interaction.options.getString('topik');
        
        // Wajib deferReply karena proses Milvus + Gemini pasti memakan waktu
        await interaction.deferReply();

        try {
            const results = await searchSkripsi(query);

            if (!results || results.length === 0) {
                return interaction.editReply('❌ Tidak ditemukan skripsi yang relevan di database.');
            }

            // --- OPTIMASI 1: Bersihkan Data & Mapping Field ---
            let contextText = "";
            results.forEach((doc, index) => {
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
// --- OPTIMASI 2: Prompt Engineering Terstruktur ---
            const prompt = `
            Kamu adalah amamiya, seorang Pemandu Akademik di KG UNSRI yang kritis, teliti, dan objektif.
            
            INPUT USER:
            "${query}"
            
            DATA RIWAYAT SKRIPSI (DATABASE 2006-2025):
            ${contextText}

            TUGAS ANALISIS:
            Bandingkan ide topik user dengan Data Riwayat Skripsi di atas. Berikan jawaban dengan format markdown persis seperti di bawah ini:

            **🔍 1. Analisis Kebaharuan (Novelty)**
            (Jelaskan secara tajam apakah topik ini fresh, inovatif, atau sudah pasaran di FKG Unsri. Jangan basa-basi).

            **⚠️ 2. Tingkat Kemiripan Topik**
            (Sebutkan secara spesifik Judul, Penulis, dan Tahun dari skripsi database yang paling mendekati. Jika ide user persis sama dengan data lama, peringatkan dengan TEGAS potensi penolakan judul. Jika berbeda jauh, nyatakan aman).

            **💡 3. Rekomendasi Pengembangan Proposal**
            (Berikan 2-3 saran konkret agar proposal makin solid. Misalnya: sarankan variabel pembeda, penggantian subjek penelitian, metrik evaluasi alternatif, atau perubahan metode uji).

            Aturan Tambahan:
            - Jangan asal menyetujui, gunakan data sebagai bukti utama.
            - Gunakan bahasa Indonesia formal, luwes, namun tegas layaknya dosen pembimbing yang menguji ide mahasiswanya.
            `;

            // Panggil AI (Perhatikan perubahan dari message.author menjadi interaction.user)
            const jawabanAI = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);

            // --- OPTIMASI 3: Button Handling ---
            const topResult = results[0];
            const row = new ActionRowBuilder();
            
            if (topResult.url && topResult.url.startsWith('http')) {
                row.addComponents(
                    new ButtonBuilder()
                        .setLabel('📖 Baca Skripsi Teratas')
                        .setStyle(ButtonStyle.Link)
                        .setURL(topResult.url)
                );
            }

            // --- OPTIMASI 4: Split Message Logic ---
            if (jawabanAI.length > 1900) {
                const chunks = jawabanAI.match(/[\s\S]{1,1900}/g) || [];
                
                await interaction.editReply(`📚 **Hasil Penelusuran & Analisis:**\n\n${chunks[0]}`);
                
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({ content: chunks[i] });
                }
                
                if (row.components.length > 0) {
                    await interaction.followUp({ components: [row] });
                }
            } else {
                await interaction.editReply({ 
                    content: `📚 **Hasil Penelusuran & Analisis:**\n\n${jawabanAI}`,
                    components: row.components.length > 0 ? [row] : []
                });
            }

        } catch (error) {
            console.error("Skripsi Command Error:", error);
            await interaction.editReply('❌ Terjadi kesalahan sistem saat menghubungi Database Milvus atau AI.');
        }
    },
};