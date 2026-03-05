const {
    SlashCommandBuilder
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Menampilkan menu utama bot'),
    async execute(interaction) {
        await interaction.reply('📜 Ini adalah menu utama bot!');
    },
};