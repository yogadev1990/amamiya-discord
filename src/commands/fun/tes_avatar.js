const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tes_avatar')
        .setDescription('Uji coba sinyal WebSocket ke Web Avatar (PoC)')
        .addStringOption(option => 
            option.setName('pesan')
                .setDescription('Pesan yang ingin dikirim ke web')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('emosi')
                .setDescription('Ekspresi wajah avatar')
                .setRequired(true)
                .addChoices(
                    { name: 'Happy', value: 'happy' },
                    { name: 'Angry', value: 'angry' },
                    { name: 'Sad', value: 'sad' },
                    { name: 'Surprised', value: 'surprised' }
                )),

    async execute(interaction) {
        const pesan = interaction.options.getString('pesan');
        const emosi = interaction.options.getString('emosi');

        // TEMBAKKAN SINYAL KE WEB BROWSER
        // Menggunakan client.io yang sudah kita pasang di index.js
        interaction.client.io.emit('ai_speak', {
            teks: pesan,
            emosi: emosi
        });

        await interaction.reply({ 
            content: `✅ Sinyal berhasil ditembakkan ke browser!\n**Emosi:** ${emosi}\n**Pesan:** ${pesan}`, 
            ephemeral: true // Hanya kamu yang bisa melihat pesan balasan ini
        });
    }
};