const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User'); // Pastikan path akurat

const talkCooldown = new Set(); 

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // 1. Validasi Keamanan: Abaikan bot
        if (message.author.bot) return;

        // Inisialisasi memori Prank jika belum ada di client
        if (!client.alginateGags) client.alginateGags = new Map();
        if (!client.lidocaineNumbs) client.lidocaineNumbs = new Map();

        // 2. Interseptor Perintah Usang
        if (message.content.startsWith('!')) {
            const warningEmbed = new EmbedBuilder()
                .setColor('#E74C3C') 
                .setTitle('⚠️ Pembaruan Arsitektur Sistem')
                .setDescription(`Halo <@${message.author.id}>, sistem operasional Amamiya telah ditingkatkan mutlak ke arsitektur **Slash Command**.\n\nPenggunaan awalan usang (\`!\`) telah dinonaktifkan secara permanen. Silakan ketik awalan garis miring (**\`/\`**) untuk memanggil perintah.`)
                .setTimestamp();
            return message.reply({ embeds: [warningEmbed] });
        }

        // Validasi: Abaikan DM
        if (!message.guild) return;

        // --- 3. SISTEM PENCEGATAN ALGINATE (MUTE) ---
        if (client.alginateGags.has(message.author.id)) {
            const expireTime = client.alginateGags.get(message.author.id);
            if (Date.now() < expireTime) {
                // Hapus pesan asli
                await message.delete().catch(() => {});
                // Kirim pesan gumaman
                await message.channel.send(`🤐 **${message.author.username}** mencoba bicara: *"Hmmmpfhh mmmphh hmph!"*`);
                return; // Eksekusi berhenti mutlak di sini (Tidak dapat XP)
            } else {
                client.alginateGags.delete(message.author.id);
            }
        }

        // --- 4. SISTEM PENCEGATAN LIDOCAINE (XP FREEZE) ---
        if (client.lidocaineNumbs.has(message.author.id)) {
            const expireTime = client.lidocaineNumbs.get(message.author.id);
            if (Date.now() < expireTime) {
                // Pesan teks biasa tetap dibiarkan masuk (tidak dihapus)
                return; // Namun eksekusi dihentikan agar mereka tidak mendapat XP
            } else {
                client.lidocaineNumbs.delete(message.author.id);
            }
        }

        // --- 5. LOGIKA INJEKSI XP ---
        if (talkCooldown.has(message.author.id)) return;

        talkCooldown.add(message.author.id);
        setTimeout(() => talkCooldown.delete(message.author.id), 60000);

        const xpToAdd = Math.floor(Math.random() * 11) + 15;

        try {
            let user = await User.findOne({ userId: message.author.id });

            if (!user) {
                user = new User({
                    userId: message.author.id, username: message.author.username,
                    xp: 0, level: 1, gold: 1000, inventory: [], totalStudy: 0
                });
            }

            user.xp += xpToAdd;
            const xpRequired = user.level * 150;

            if (user.xp >= xpRequired) {
                user.level += 1;
                user.gold += 500;

                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('📈 Peningkatan Kapasitas Akademik')
                    .setDescription(`Selamat <@${message.author.id}>! Anda telah naik ke **Level ${user.level}**.\n\nSistem telah menyuntikkan bonus **+500 Gold** ke saldo Anda.`)
                    .setThumbnail(message.author.displayAvatarURL());

                await message.channel.send({ embeds: [levelUpEmbed] });
            }

            await user.save();
        } catch (error) {
            console.error("Kesalahan Basis Data pada messageCreate:", error);
        }
    },
};