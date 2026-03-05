const { SlashCommandBuilder } = require('discord.js');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tanya')
        .setDescription('Tanya AI (support teks & gambar)')
        .addStringOption(option =>
            option.setName('pertanyaan')
                .setDescription('Pertanyaan untuk AI')
                .setRequired(false)
        )
        .addAttachmentOption(option =>
            option.setName('gambar')
                .setDescription('Upload gambar untuk dianalisis AI')
                .setRequired(false)
        ),

    async execute(interaction) {

        const textQuery = interaction.options.getString('pertanyaan');
        const attachment = interaction.options.getAttachment('gambar');

        if (!textQuery && !attachment) {
            return interaction.reply({
                content: '❓ Berikan pertanyaan atau upload gambar.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {

            let imageUrl = null;
            let mimeType = null;

            // jika ada gambar
            if (attachment) {

                if (!attachment.contentType?.startsWith('image/')) {
                    return interaction.editReply('⚠️ File harus berupa gambar (JPG / PNG).');
                }

                imageUrl = attachment.url;
                mimeType = attachment.contentType;
            }

            const jawaban = await GeminiAi.run(
                interaction.user.id,
                interaction.user.username,
                textQuery || "Jelaskan gambar ini",
                imageUrl,
                mimeType
            );

            // handle limit 2000 char
            if (jawaban.length > 2000) {

                const chunks = jawaban.match(/[\s\S]{1,1900}/g) || [];

                await interaction.editReply(chunks[0]);

                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp(chunks[i]);
                }

            } else {

                await interaction.editReply(jawaban);

            }

        } catch (error) {

            console.error(error);

            await interaction.editReply(
                '❌ Terjadi kesalahan saat menghubungi Amamiya.'
            );
        }
    }
};