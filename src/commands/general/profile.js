const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User'); // Load Model MongoDB

module.exports = {
    name: 'profile',
    description: 'Lihat Kartu Tanda Mahasiswa (KTM) & Statistik',
    async execute(message, args) {
        const target = message.mentions.users.first() || message.author;
        const member = message.guild.members.cache.get(target.id);

        try {
            // 1. Ambil Data dari MongoDB
            let user = await User.findOne({ userId: target.id });

            // Jika user belum ada di DB, tampilkan data default (Mahasiswa Baru)
            if (!user) {
                user = {
                    gold: 1000,
                    xp: 0,
                    level: 1,
                    inventory: [],
                    totalStudy: 0
                };
            }

            // 2. Cek Role Angkatan (Visual Only)
            const angkatanRole = member.roles.cache.find(r => r.name.startsWith('Angkatan'))?.name || 'Mahasiswa Umum';

            // 3. Hitung Total Jam Belajar (Format Jam:Menit)
            // Handle jika field totalStudy belum ada di schema lama
            const totalMinutes = user.totalStudy || 0;
            const jam = Math.floor(totalMinutes / 60);
            const menit = totalMinutes % 60;

            // 4. Buat Embed
            const embed = new EmbedBuilder()
                .setColor(member.displayHexColor)
                .setTitle(`🎓 KTM: ${target.username.toUpperCase()}`)
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '🏷️ Status', value: angkatanRole, inline: true },
                    { name: '⭐ Level', value: `${user.level}`, inline: true },
                    { name: '✨ XP', value: `${user.xp} pts`, inline: true },
                    
                    { name: '💰 Kekayaan', value: `${user.gold} Gold`, inline: true },
                    { name: '🎒 Inventory', value: `${user.inventory.length} Item`, inline: true },
                    { name: '📚 Total Jam Belajar', value: `${jam} Jam ${menit} Menit`, inline: true },
                    
                    { name: 'Bergabung', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: false }
                )
                .setFooter({ text: `User ID: ${target.id} • Universitas Sriwijaya` });

            message.reply({ embeds: [embed] });

        } catch (err) {
            console.error("Profile Error:", err);
            message.reply("❌ Gagal mengambil data profil dari database.");
        }
    },
};