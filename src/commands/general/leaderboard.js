const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../shared/models/User'); // Pastikan path akurat

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Melihat peringkat 10 besar mahasiswa paling aktif dan rajin'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // 1. Tarik 10 data teratas berdasarkan XP (Descending)
            const topUsers = await User.find().sort({ xp: -1 }).limit(10);

            if (!topUsers.length) {
                return interaction.editReply('⚠️ **Basis Data Kosong:** Belum ada rekam jejak akademik mahasiswa di sistem ini.');
            }

            // 2. Format UI Baris demi Baris
            const leaderboardString = topUsers.map((user, index) => {
                let rankIcon = '';
                if (index === 0) rankIcon = '🥇';
                else if (index === 1) rankIcon = '🥈';
                else if (index === 2) rankIcon = '🥉';
                else rankIcon = `\`#${index + 1}\``;

                // Kalkulasi Jam Belajar untuk ditampilkan
                const studyMinutes = user.totalStudy || 0;
                const hours = Math.floor(studyMinutes / 60);
                const minutes = studyMinutes % 60;
                const studyText = hours > 0 ? `${hours}j ${minutes}m` : `${minutes}m`;

                return `${rankIcon} **${user.username}**\n> 🏆 Lvl ${user.level} | ✨ ${user.xp.toLocaleString()} XP | 📚 Belajar: ${studyText}`;
            }).join('\n\n');

            // 3. Render Antarmuka (Embed)
            const embed = new EmbedBuilder()
                .setColor('#F1C40F') // Emas Akademik
                .setTitle('🏆 Papan Peringkat Akademik FKG')
                .setDescription(`Berikut adalah daftar 10 mahasiswa dengan akumulasi *Experience Point* (XP) dan jam terbang tertinggi di server ini:\n\n${leaderboardString}`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png') // Ikon piala
                .setFooter({ 
                    text: 'Sistem Penilaian Otomatis Amamiya', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Kesalahan Papan Peringkat:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali saat mengambil data dari server utama.");
        }
    },
};
