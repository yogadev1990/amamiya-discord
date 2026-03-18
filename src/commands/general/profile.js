const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const User = require('../../shared/models/User'); // Load Model MongoDB

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Lihat Kartu Tanda Mahasiswa (KTM) & Statistik Akademik')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Pilih mahasiswa lain untuk melihat profil mereka (kosongkan untuk diri sendiri)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Mengunci sesi karena ada potensi pemanggilan database dan API
        await interaction.deferReply();

        // Mengambil target user (Jika tidak diisi, maka target adalah orang yang mengetik command)
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        try {
            // 1. Ambil Data dari MongoDB
            let user = await User.findOne({ userId: targetUser.id });

            // Data Default (Dummy) jika user tidak ada di DB
            if (!user) {
                user = {
                    gold: 1000,
                    xp: 0,
                    level: 1,
                    inventory: [],
                    totalStudy: 0,
                    robloxId: null,      
                    robloxUsername: null 
                };
            }

            // 2. Cek Role Angkatan (Visual Only)
            const angkatanRole = targetMember?.roles.cache.find(r => r.name.startsWith('KG'))?.name || 'Mahasiswa Umum';

            // 3. Hitung Jam Belajar
            const totalMinutes = user.totalStudy || 0;
            const jam = Math.floor(totalMinutes / 60);
            const menit = totalMinutes % 60;

            // 4. Cek Status Roblox & Tarik Gambar Asli (Hash CDN)
            let robloxField = "❌ Belum Terhubung\n(Gunakan `/connect`)";
            let thumbnailURL = targetUser.displayAvatarURL({ dynamic: true, size: 512 }); 

            if (user.robloxId) {
                robloxField = `✅ **${user.robloxUsername}**\nID: ${user.robloxId}`;
                
                // Menarik hash gambar terbaru dari CDN Roblox
                try {
                    const thumbResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.robloxId}&size=420x420&format=Png&isCircular=false`);
                    if (thumbResponse.data && thumbResponse.data.data.length > 0) {
                        thumbnailURL = thumbResponse.data.data[0].imageUrl;
                    }
                } catch (thumbErr) {
                    console.error("Gagal menarik hash gambar Roblox untuk profile:", thumbErr.message);
                }
            }

            // 5. Buat Embed KTM yang Terstruktur
            const profileEmbed = new EmbedBuilder()
                .setColor(targetMember?.displayHexColor || '#00BFFF') // Menggunakan warna role user atau biru default
                .setTitle(`🎓 Kartu Tanda Mahasiswa: ${targetUser.displayName.toUpperCase()}`)
                .setThumbnail(thumbnailURL) 
                .addFields(
                    { name: '🏷️ Status', value: angkatanRole, inline: true },
                    { name: '🎮 Integrasi Roblox', value: robloxField, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true }, // Spacer rapi
                    
                    { name: '⭐ Level Sistem', value: `Level ${user.level}`, inline: true },
                    { name: '✨ Experience (XP)', value: `${user.xp} pts`, inline: true },
                    { name: '💰 Saldo Gold', value: `${user.gold} Gold`, inline: true },
                    
                    { name: '🎒 Inventory', value: `${user.inventory.length} Item Tersimpan`, inline: true },
                    { name: '📚 Total Jam Belajar', value: `${jam} Jam ${menit} Menit`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true }, // Spacer baris bawah
                    
                    { name: '📅 Bergabung Sejak', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setFooter({ 
                    text: `Amamiya AI • Command: /profile`,
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Eksekusi Pengiriman Antarmuka
            await interaction.editReply({ embeds: [profileEmbed] });

        } catch (err) {
            console.error("Kesalahan Profil Sistem:", err);
            await interaction.editReply({
                content: "❌ **Database Error:** Gagal memuat data profil KTM dari server MongoDB utama."
            });
        }
    },
};
