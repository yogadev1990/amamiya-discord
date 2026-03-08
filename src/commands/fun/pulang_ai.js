const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pulang_ai')
        .setDescription('Suruh AI VTuber keluar dari Voice Channel'),

    async execute(interaction) {
        // Cari koneksi suara bot di server ini
        const connection = getVoiceConnection(interaction.guild.id);

        if (!connection) {
            return interaction.reply({ 
                content: '❌ AI sedang tidak berada di Voice Channel mana pun.', 
                ephemeral: true 
            });
        }

        // Putus koneksi dan hancurkan instance voice
        connection.destroy();

        // Kirim sinyal ke web agar avatar tertidur/reset (opsional)
        interaction.client.io.emit('ai_speak', {
            teks: "*[AI telah meninggalkan percakapan]*",
            emosi: "neutral"
        });

        await interaction.reply('👋 AI telah keluar dari Voice Channel. Sampai jumpa!');
    }
};