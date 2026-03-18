const { SlashCommandBuilder } = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kutip')
        .setDescription('Buat daftar pustaka otomatis (Style: Vancouver/APA)')
        .addStringOption(option => 
            option.setName('sumber')
                .setDescription('Judul/Link/DOI sumber')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Style sitasi')
                .setRequired(false)
                .addChoices(
                    { name: 'Vancouver', value: 'vancouver' },
                    { name: 'APA', value: 'apa' },
                    { name: 'Harvard', value: 'harvard' }
                )
        ),
    async execute(interaction) {
        const style = interaction.options.getString('style') || 'vancouver';
        const query = interaction.options.getString('sumber');

        await interaction.deferReply();

        const prompt = `
        Tolong buatkan sitasi/daftar pustaka untuk sumber berikut: "${query}"
        
        Format yang diminta: **${style.toUpperCase()} Style**.
        
        Instruksi:
        1. Cari metadata buku/jurnal tersebut (Penulis, Tahun, Judul, Penerbit/DOI) dari pengetahuanmu.
        2. Berikan output HANYA teks sitasinya saja agar siap dicopy-paste.
        3. Jika sumber tidak jelas, berikan format template umum saja.
        `;

        try {
            const hasil = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);
            await interaction.editReply(`📝 **Sitasi (${style.toUpperCase()}):**\n\`\`\`${hasil}\`\`\``);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Gagal membuat sitasi.');
        }
    },
};
