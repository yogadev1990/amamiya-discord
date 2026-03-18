const { SlashCommandBuilder } = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kerangka')
        .setDescription('Bantu buntu ide? Buat kerangka skripsi Bab 1-3 dari judulmu.')
        .addStringOption(option => 
            option.setName('judul')
                .setDescription('Judul skripsi')
                .setRequired(true)
        ),
    async execute(interaction) {
        const judul = interaction.options.getString('judul');
        await interaction.deferReply();

        const prompt = `
        User adalah mahasiswa Kedokteran Gigi yang sedang menyusun skripsi.
        Judul Skripsi: "${judul}"
        
        Tugasmu adalah membuatkan OUTLINE (Kerangka) kasar untuk Bab 1, 2, dan 3.
        
        Format Output:
        **BAB 1: PENDAHULUAN**
        * **Latar Belakang:** [Saran poin-poin masalah apa yang harus dibahas. Hubungkan dengan prevalensi penyakit gigi atau urgensi bahan herbal jika relevan]
        * **Rumusan Masalah:** [Contoh kalimat rumusan masalah]
        * **Tujuan Penelitian:** [Tujuan umum & khusus]
        
        **BAB 2: TINJAUAN PUSTAKA**
        * [List topik teori apa saja yang WAJIB dimasukkan. Misal: Morfologi bakteri, Kandungan kimia daun sirih, dll]
        * [Saran Kerangka Teori singkat]

        **BAB 3: METODE PENELITIAN**
        * **Jenis Penelitian:** [Saran: Eksperimental Laboratoris / Klinis / Observasional?]
        * **Sampel:** [Saran sampelnya apa]
        * **Variabel:** [Variabel Bebas & Terikat]
        * **Analisis Data:** [Saran uji statistik: T-Test / ANOVA / Kruskal Wallis?]

        Gunakan bahasa akademis Indonesia yang baik.
        `;

        try {
            const hasil = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);
            
            if (hasil.length > 1900) {
                const chunks = hasil.match(/[\s\S]{1,1900}/g) || [];
                await interaction.editReply(`📑 **Saran Kerangka Skripsi:**\n*Judul: ${judul}*`);
                for (const chunk of chunks) {
                    await interaction.channel.send(chunk);
                }
            } else {
                await interaction.editReply(`📑 **Saran Kerangka Skripsi:**\n*Judul: ${judul}*\n\n${hasil}`);
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Gagal menyusun kerangka. Gemini lagi buntu.');
        }
    },
};
