const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios'); 
const User = require('../../models/User'); 

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
            // 1. Eksekusi Pencarian Identitas ke Peladen Pusat Roblox
            const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxUsername],
                excludeBannedUsers: true
            });

            const userData = userResponse.data.data;

            if (userData.length === 0) {
                return interaction.editReply({ 
                    content: `❌ **Akses Ditolak:** Username Roblox **${robloxUsername}** tidak ditemukan di peladen global.` 
                });
            }

            const robloxData = userData[0]; 
            const robloxId = robloxData.id.toString();
            const realUsername = robloxData.name; 

            // 2. Eksekusi Penarikan Hash Gambar Avatar (CDN Roblox)
            let avatarHashUrl = null;
            try {
                const thumbResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=420x420&format=Png&isCircular=false`);
                if (thumbResponse.data && thumbResponse.data.data.length > 0) {
                    // Mengambil tautan CDN berekstensi hash yang Anda maksud
                    avatarHashUrl = thumbResponse.data.data[0].imageUrl;
                }
            } catch (thumbErr) {
                console.error("Gagal menarik hash gambar Roblox:", thumbErr.message);
                // Biarkan null jika gagal, Discord Embed akan mengabaikan gambar yang kosong
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
                    { name: '👤 Username Valid', value: realUsername, inline: true },
                    { name: '🆔 ID Sistem', value: robloxId, inline: true }
                )
                .setFooter({ 
                    text: 'Amamiya AI • Command: /connect',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Memasang gambar hash CDN jika berhasil ditarik
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