const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Tanya otak pusat Amamiya AI (Mendukung analisis Teks & Gambar)')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Ketikkan pertanyaan, gejala medis, atau topik jurnal di sini')
                .setRequired(true) // Diubah menjadi false agar user bisa kirim gambar saja tanpa teks
        )
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Unggah gambar rontgen, diagram, atau jurnal untuk dianalisis')
                .setRequired(false)
        ),

    async execute(interaction) {
        const textQuery = interaction.options.getString('question');
        const attachment = interaction.options.getAttachment('image');

        // Validasi Mutlak: Harus ada minimal salah satu (Teks atau Gambar)
        if (!textQuery && !attachment) {
            return interaction.reply({
                content: '❌ **Akses Ditolak:** Anda wajib memberikan pertanyaan teks atau mengunggah gambar.',
                ephemeral: true
            });
        }

        // Memberikan indikator "Amamiya is thinking..." kepada pengguna
        await interaction.deferReply();

        try {
            let imageUrl = null;
            let mimeType = null;

            // Memproses Lampiran Gambar
            if (attachment) {
                if (!attachment.contentType?.startsWith('image/')) {
                    return interaction.editReply('⚠️ **Format Ditolak:** File yang diunggah harus berupa gambar (JPG / PNG).');
                }
                imageUrl = attachment.url;
                mimeType = attachment.contentType;
            }

            // Eksekusi Panggilan ke Otak Pusat Gemini
            const defaultPrompt = textQuery || "Jelaskan secara detail apa yang ada di dalam gambar ini dengan analisis yang presisi.";
            const jawaban = await GeminiAi.run(
                interaction.user.id,
                interaction.user.username,
                defaultPrompt,
                imageUrl,
                mimeType
            );

            // Membangun Antarmuka UI (Embed) yang Futuristik
            const askEmbed = new EmbedBuilder()
                .setColor('#00BFFF') // Biru klinis Amamiya
                .setAuthor({ 
                    name: `Pertanyaan dari: ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setFooter({ 
                    text: 'Amamiya AI • Command: /ask', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Memasang gambar ke dalam bingkai jika pengguna mengunggahnya
            if (attachment) {
                askEmbed.setImage(attachment.url);
            }

            // Manajemen Batas Karakter (Discord Embed Description Limit: 4096 Karakter)
            if (jawaban.length <= 4096) {
                askEmbed.setDescription(jawaban);
                await interaction.editReply({ embeds: [askEmbed] });
            } else {
                // Jika jawaban super panjang, potong secara presisi
                const chunks = jawaban.match(/[\s\S]{1,4000}/g) || [];
                
                askEmbed.setDescription(chunks[0]);
                await interaction.editReply({ embeds: [askEmbed] });

                // Kirim sisa potongan sebagai pesan berantai (FollowUp)
                for (let i = 1; i < chunks.length; i++) {
                    const followUpEmbed = new EmbedBuilder()
                        .setColor('#00BFFF')
                        .setDescription(chunks[i]);
                    await interaction.followUp({ embeds: [followUpEmbed] });
                }
            }

        } catch (error) {
            console.error("Kesalahan Sistem Amamiya AI:", error);
            await interaction.editReply(
                '❌ **Koneksi Terputus:** Terjadi kesalahan internal saat menghubungi server Amamiya.'
            );
        }
    }
};