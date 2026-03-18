const { SlashCommandBuilder } = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('para')
        .setDescription('Tulis ulang kalimat agar lolos plagiasi (Paraphraser)')
        .addStringOption(option => 
            option.setName('teks')
                .setDescription('Teks yang ingin diparafrase')
                .setRequired(true)
        ),
    async execute(interaction) {
        const teksAsli = interaction.options.getString('teks');

        await interaction.deferReply();

        const prompt = `
        Lakukan parafrase (tulis ulang) pada teks berikut agar:
        1. Struktur kalimat berubah tapi makna TETAP SAMA.
        2. Menggunakan kosakata akademis/ilmiah yang baik.
        3. Tujuannya untuk menurunkan skor plagiasi Turnitin.
        4. Bahasa: Indonesia Formal.

        Teks Asli: "${teksAsli}"
        
        Berikan 2 opsi variasi hasil parafrase.
        `;

        try {
            const hasil = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);
            await interaction.editReply(`✍️ **Hasil Parafrase:**\n${hasil}`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Gagal memproses parafrase.');
        }
    },
};
