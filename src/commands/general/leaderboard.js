const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'leaderboard',
    description: 'Lihat siapa yang paling rajin belajar (Top 10)',
    async execute(message, args) {
        // 1. Ambil 10 user dengan XP tertinggi
        // sort({ xp: -1 }) artinya urutkan XP dari besar ke kecil (Descending)
        const topUsers = await User.find().sort({ xp: -1 }).limit(10);

        if (!topUsers.length) {
            return message.reply('Belum ada data mahasiswa yang tersimpan.');
        }

        // 2. Susun string daftar juara
        // Kita pakai map untuk mengubah array object menjadi string teks
        const leaderboardString = topUsers.map((user, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            else medal = `**#${index + 1}**`;

            return `${medal} **${user.username}** — Level ${user.level} (${user.xp} XP)`;
        }).join('\n');

        // 3. Tampilkan Embed
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F) // Warna Emas
            .setTitle('🏆 Papan Peringkat Mahasiswa Rajin')
            .setDescription(leaderboardString)
            .setFooter({ text: 'Terus belajar biar jadi nomor 1!' });

        await message.channel.send({ embeds: [embed] });
    },
};