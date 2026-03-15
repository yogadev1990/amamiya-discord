const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios'); 
const User = require('../../models/User'); // Pastikan path model Anda akurat

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
        // Mengunci sesi (Mencegah timeout 3 detik Discord saat menunggu API)
        await interaction.deferReply();

        // Mengambil input dari antarmuka Slash Command
        const robloxUsername = interaction.options.getString('username');

        try {
            // 1. Eksekusi Pencarian ke Peladen Pusat Roblox
            const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxUsername],
                excludeBannedUsers: true
            });

            const data = response.data.data;

            // Validasi: Jika data kosong, gagalkan proses
            if (data.length === 0) {
                return interaction.editReply({ 
                    content: `❌ **Akses Ditolak:** Username Roblox **${robloxUsername}** tidak ditemukan di peladen global. Periksa kembali ejaan Anda.` 
                });
            }

            const robloxData = data[0]; 
            const robloxId = robloxData.id.toString();
            const realUsername = robloxData.name; 

            // 2. Injeksi Data ke MongoDB Kampus
            await User.findOneAndUpdate(
                { userId: interaction.user.id },
                { 
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    robloxId: robloxId,
                    robloxUsername: realUsername,
                    // Parameter bawaan mahasiswa baru
                    $setOnInsert: { 
                        xp: 0, 
                        level: 1, 
                        gold: 1000, 
                        inventory: [] 
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // 3. Merender Antarmuka Konfirmasi
            const successEmbed = new EmbedBuilder()
                .setColor('#00BFFF') // Biru klinis sistem Amamiya
                .setTitle('✅ Sinkronisasi Identitas Berhasil')
                .setDescription(`Sistem telah memverifikasi dan menautkan profil Discord Anda dengan basis data praktikum Roblox secara permanen.`)
                // Mengambil foto profil 3D Roblox secara langsung
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`)
                .addFields(
                    { name: '👤 Username Valid', value: realUsername, inline: true },
                    { name: '🆔 ID Sistem', value: robloxId, inline: true }
                )
                .setFooter({ 
                    text: 'Amamiya AI • Registrasi Praktikum',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Mengirimkan UI ke pengguna
            await interaction.editReply({ embeds: [successEmbed] });

        } catch (err) {
            console.error("Kesalahan Sinkronisasi Roblox:", err);
            await interaction.editReply({
                content: "❌ **Koneksi Gagal:** Terjadi anomali saat menghubungi API Roblox atau menulis ke dalam database."
            });
        }
    },
};