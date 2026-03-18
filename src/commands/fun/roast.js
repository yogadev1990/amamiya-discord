const { SlashCommandBuilder } = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Minta dospem killer me-review judul/alasan kamu (Sarkas Mode!)')
        .addStringOption(option => 
            option.setName('topik')
                .setDescription('Judul skripsi atau keluhanmu yang ingin di-roast')
                .setRequired(true)
        ),
    async execute(interaction) {
        const inputUser = interaction.options.getString('topik');
        await interaction.deferReply();

        const prompt = `
        Mode: DOSEN PEMBIMBING KILLER & SARKAS.
        User (Mahasiswa Abadi) memberikan input: "${inputUser}"
        
        Tugasmu:
        1. Kritis input tersebut dengan pedas, lucu, dan sarkas.
        2. Gunakan gaya bahasa dosen yang meremehkan tapi sebenarnya peduli (sedikit).
        3. Singgung soal "Kapan wisuda?", "Revisi terus", atau "Judul pasaran".
        4. Jangan terlalu kasar (hate speech), tapi cukup bikin "kena mental".
        5. Bahasa gaul/sehari-hari campur formal.
        
        Contoh tone: "Judul macam apa ini? Anak SD juga bisa bikin. Kapan mau lulus kalau pola pikirmu masih begini?"
        `;

        try {
            const hasil = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);
            await interaction.editReply(`🔥 **Dospem Killer:**\n"${hasil}"`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Dospemnya lagi cuti (Error).');
        }
    },
};
