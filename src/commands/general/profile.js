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

            // Data Default (Dummy) jika user tidak ada di DB
            if (!user) {
                user = {
                    gold: 1000,
                    xp: 0,
                    level: 1,
                    inventory: [],
                    totalStudy: 0,
                    robloxId: null,      // Default null
                    robloxUsername: null // Default null
                };
            }

            // 2. Cek Role Angkatan (Visual Only)
            const angkatanRole = member.roles.cache.find(r => r.name.startsWith('Angkatan'))?.name || 'Mahasiswa Umum';

            // 3. Hitung Jam Belajar
            const totalMinutes = user.totalStudy || 0;
            const jam = Math.floor(totalMinutes / 60);
            const menit = totalMinutes % 60;

            // 4. Cek Status Roblox
            let robloxField = "❌ Belum Terhubung\n(Gunakan `!connect`)";
            let thumbnailURL = target.displayAvatarURL(); // Default pakai foto Discord

            if (user.robloxId) {
                robloxField = `✅ **${user.robloxUsername}**\nID: ${user.robloxId}`;
                // Pakai foto kepala karakter Roblox biar keren
                thumbnailURL = `https://www.roblox.com/headshot-thumbnail/image?userId=${user.robloxId}&width=420&height=420&format=png`;
            }

            // 5. Buat Embed KTM
            const embed = new EmbedBuilder()
                .setColor(member.displayHexColor)
                .setTitle(`🎓 KTM: ${target.username.toUpperCase()}`)
                .setThumbnail(thumbnailURL) // Foto akan berubah jadi Roblox jika connect
                .addFields(
                    { name: '🏷️ Status', value: angkatanRole, inline: true },
                    { name: '🎮 Roblox', value: robloxField, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true }, // Spacer kosong biar rapi 3 kolom

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