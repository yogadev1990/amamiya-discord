const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'daily',
    description: 'Absen harian untuk dapat gaji/uang saku',
    async execute(message, args) {
        let user = await User.findOne({ userId: message.author.id });
        if (!user) {
            user = await User.create({ userId: message.author.id, username: message.author.username });
        }

        // Cek Cooldown (24 Jam)
        const cooldown = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
        const lastDaily = user.lastDaily ? user.lastDaily.getTime() : 0;
        const now = Date.now();

        if (now - lastDaily < cooldown) {
            const sisaWaktu = cooldown - (now - lastDaily);
            const jam = Math.floor(sisaWaktu / (1000 * 60 * 60));
            const menit = Math.floor((sisaWaktu % (1000 * 60 * 60)) / (1000 * 60));
            
            return message.reply(`🛑 **Sabar dong!** Uangnya cair lagi dalam **${jam} jam ${menit} menit**.`);
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

        message.reply({ embeds: [embed] });
    },
};