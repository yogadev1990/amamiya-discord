const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Absen harian untuk dapat gaji/uang saku'),
    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) {
            user = await User.create({ userId: interaction.user.id, username: interaction.user.username });
        }

        // Cek Cooldown (24 Jam)
        const cooldown = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
        const lastDaily = user.lastDaily ? user.lastDaily.getTime() : 0;
        const now = Date.now();

        if (now - lastDaily < cooldown) {
            const sisaWaktu = cooldown - (now - lastDaily);
            const jam = Math.floor(sisaWaktu / (1000 * 60 * 60));
            const menit = Math.floor((sisaWaktu % (1000 * 60 * 60)) / (1000 * 60));
            
            return interaction.reply(`🛑 **Sabar dong!** Uangnya cair lagi dalam **${jam} jam ${menit} menit**.`);
        }

        // Beri Hadiah (Random 500 - 1000 Gold)
        const reward = Math.floor(Math.random() * (1000 - 500 + 1)) + 500;
        
        user.gold += reward;
        user.lastDaily = new Date();
        await user.save();

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('💰 UANG JAJAN CAIR!')
            .setDescription(`Kamu telah melakukan absen harian.\n\n➕ **${reward} Gold**\nTotal Uang: **${user.gold} Gold**`)
            .setFooter({ text: 'Gunakan uang ini buat Gacha ya!' });

        await interaction.reply({ embeds: [embed] });
    },
};
