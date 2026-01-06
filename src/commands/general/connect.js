const { EmbedBuilder } = require('discord.js');
const axios = require('axios'); // Wajib install: npm install axios
const User = require('../../models/User'); // Sesuaikan path model User kamu

module.exports = {
    name: 'connect',
    description: 'Hubungkan akun Discord dengan Roblox untuk akses Praktikum',
    async execute(message, args) {
        const robloxUsername = args[0];

        // Validasi input
        if (!robloxUsername) {
            return message.reply("❌ **Format Salah!**\nGunakan: `!connect <username_roblox>`\nContoh: `!connect revanda1990`");
        }

        const loadingMsg = await message.reply("🔍 Mencari data akun Roblox...");

        try {
            // 1. Cek ke API Roblox untuk mendapatkan ID dari Username
            const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [robloxUsername],
                excludeBannedUsers: true
            });

            const data = response.data.data;

            // Jika username tidak ditemukan
            if (data.length === 0) {
                return loadingMsg.edit(`❌ Username Roblox **${robloxUsername}** tidak ditemukan! Pastikan ejaan benar.`);
            }

            const robloxData = data[0]; // { requestedUsername, hasVerifiedBadge, id, name, displayName }
            const robloxId = robloxData.id.toString();
            const realUsername = robloxData.name; // Username asli (case sensitive)

            // 2. Simpan ke MongoDB (Upsert: Update jika ada, Create jika belum)
            await User.findOneAndUpdate(
                { userId: message.author.id },
                { 
                    userId: message.author.id,
                    username: message.author.username,
                    robloxId: robloxId,
                    robloxUsername: realUsername,
                    // Set default value jika user baru
                    $setOnInsert: { 
                        xp: 0, 
                        level: 1, 
                        gold: 1000, 
                        inventory: [] 
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // 3. Konfirmasi Berhasil
            const embed = new EmbedBuilder()
                .setColor('#00AAFF')
                .setTitle('✅ Akun Berhasil Terhubung!')
                .setDescription(`Akun Discord kamu sekarang terhubung dengan Roblox.`)
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`)
                .addFields(
                    { name: 'Roblox Username', value: realUsername, inline: true },
                    { name: 'Roblox ID', value: robloxId, inline: true }
                )
                .setFooter({ text: 'Data tersimpan di Database Kampus' });

            loadingMsg.edit({ content: null, embeds: [embed] });

        } catch (err) {
            console.error(err);
            loadingMsg.edit("❌ Terjadi kesalahan saat menghubungi server Roblox atau Database.");
        }
    },
};