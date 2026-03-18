const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios'); 
const User = require('../../shared/models/User'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('connect')
        .setDescription('Sinkronisasi akun Discord dengan server praktikum Roblox')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Ketik username asli Roblox Anda (bukan Display Name)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const robloxUsername = interaction.options.getString('username');

        try {
            // 1. Eksekusi Pencarian Identitas ke server Pusat Roblox
            const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxUsername],
                excludeBannedUsers: true
            });

            const userData = userResponse.data.data;

            if (userData.length === 0) {
                return interaction.editReply({ 
                    content: `❌ **Akses Ditolak:** Username Roblox **${robloxUsername}** tidak ditemukan di server global.` 
                });
            }

            const robloxData = userData[0]; 
            const robloxId = robloxData.id.toString();
            const realUsername = robloxData.name; 
            const displayName = robloxData.displayName; // Ekstraksi Nickname/Display Name

            // 2. Eksekusi Penarikan Hash Gambar Avatar (CDN Roblox)
            let avatarHashUrl = null;
            try {
                const thumbResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=420x420&format=Png&isCircular=false`);
                if (thumbResponse.data && thumbResponse.data.data.length > 0) {
                    avatarHashUrl = thumbResponse.data.data[0].imageUrl;
                }
            } catch (thumbErr) {
                console.error("Gagal menarik hash gambar Roblox:", thumbErr.message);
            }

            // 3. Injeksi Data ke MongoDB Kampus
            await User.findOneAndUpdate(
                { userId: interaction.user.id },
                { 
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    robloxId: robloxId,
                    robloxUsername: realUsername,
                    $setOnInsert: { 
                        xp: 0, 
                        level: 1, 
                        gold: 1000, 
                        inventory: [] 
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // 4. Merender Antarmuka Konfirmasi
            const successEmbed = new EmbedBuilder()
                .setColor('#00BFFF') 
                .setTitle('✅ Sinkronisasi Identitas Berhasil')
                .setDescription(`Sistem telah memverifikasi dan menautkan profil Discord Anda dengan basis data praktikum Roblox secara permanen.`)
                .addFields(
                    { name: '🏷️ Display Name', value: displayName, inline: true },
                    { name: '👤 Username', value: realUsername, inline: true },
                    { name: '🆔 ID', value: robloxId, inline: false }
                )
                .setFooter({ 
                    text: 'Amamiya AI • Command: /connect',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            if (avatarHashUrl) {
                successEmbed.setThumbnail(avatarHashUrl);
            }

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (err) {
            console.error("Kesalahan Sinkronisasi Roblox:", err);
            await interaction.editReply({
                content: "❌ **Koneksi Gagal:** Terjadi anomali saat menghubungi API Roblox atau menulis ke dalam database."
            });
        }
    },
};
