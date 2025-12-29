const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User'); // Pastikan path ini benar ke model User.js

module.exports = {
    name: 'profile',
    description: 'Cek status level dan XP kamu',
    async execute(message, args) {
        // 1. Cari data user di database
        // Kita gunakan findOne berdasarkan ID Discord
        let user = await User.findOne({ userId: message.author.id });

        // 2. Jika user belum pernah chat sama sekali (belum ada di DB)
        if (!user) {
            return message.reply('Kamu belum terdaftar di database Amamiya. Coba ngobrol dulu pakai `!tanya`!');
        }

        // 3. Hitung target XP untuk naik level (Rumus sederhana: Level * 100)
        const nextLevelXp = user.level * 100;
        
        // 4. Buat Tampilan Embed (Kartu)
        const embed = new EmbedBuilder()
            .setColor(0x9B59B6) // Warna Ungu
            .setTitle(`👤 Kartu Mahasiswa: ${user.username || message.author.username}`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🎓 Level', value: `Semester ${user.level}`, inline: true },
                { name: '✨ Experience (XP)', value: `${user.xp} / ${nextLevelXp}`, inline: true },
                { name: '💰 Uang Saku', value: `${user.gold || 0} Gold`, inline: true },
                { name: '📅 Terakhir Interaksi', value: `<t:${Math.floor(new Date(user.lastInteraction).getTime() / 1000)}:R>`, inline: false }
            )
            .setFooter({ text: 'Rajin bertanya pangkal pandai!' });

        await message.channel.send({ embeds: [embed] });
    },
};