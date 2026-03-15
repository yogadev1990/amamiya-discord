const { EmbedBuilder } = require('discord.js');
const User = require('../models/User'); // Pastikan path MongoDB akurat

const talkCooldown = new Set(); // Penampung memori cooldown untuk Anti-Spam

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // 1. Validasi Keamanan Mutlak: Abaikan pesan dari bot lain
        if (message.author.bot) return;

        // 2. Interseptor Perintah Usang (Peringatan Transisi ke Slash Command)
        if (message.content.startsWith('!')) {
            const warningEmbed = new EmbedBuilder()
                .setColor('#E74C3C') // Merah Klinis / Peringatan
                .setTitle('⚠️ Pembaruan Arsitektur Sistem')
                .setDescription(`Halo <@${message.author.id}>, sistem operasional Amamiya telah ditingkatkan mutlak ke arsitektur **Slash Command** demi keamanan dan efisiensi.\n\nPenggunaan awalan usang (\`!\`) telah dinonaktifkan secara permanen di server ini. Silakan ketik awalan garis miring (**\`/\`**) untuk memanggil perintah. \n\nKetik **/menu** untuk melihat daftar perintah yang aktif.`)
                .setTimestamp();

            // Membalas langsung pesan usang tersebut dan menghentikan eksekusi kode di bawahnya
            return message.reply({ embeds: [warningEmbed] });
        }

        // --- BATAS SUCI: Kode di bawah ini khusus untuk obrolan teks biasa (XP System) ---

        // Validasi: XP hanya diberikan untuk pesan di dalam Server Kampus, bukan Direct Message (DM)
        if (!message.guild) return;

        // 3. Sistem Cooldown Anti-Spam (60 Detik)
        if (talkCooldown.has(message.author.id)) return;

        talkCooldown.add(message.author.id);
        setTimeout(() => talkCooldown.delete(message.author.id), 60000);

        // 4. Injeksi Experience Points (Menghasilkan 15 - 25 XP acak)
        const xpToAdd = Math.floor(Math.random() * 11) + 15;

        try {
            // Mencari atau membuat profil akademis mahasiswa
            let user = await User.findOne({ userId: message.author.id });

            if (!user) {
                user = new User({
                    userId: message.author.id,
                    username: message.author.username,
                    xp: 0,
                    level: 1,
                    gold: 1000,
                    inventory: [],
                    totalStudy: 0
                });
            }

            user.xp += xpToAdd;
            const xpRequired = user.level * 150;

            // 5. Algoritma Kenaikan Level Otomatis
            if (user.xp >= xpRequired) {
                user.level += 1;
                user.gold += 500;

                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#2ECC71') // Hijau Sukses
                    .setTitle('📈 Peningkatan Kapasitas Akademik')
                    .setDescription(`Selamat <@${message.author.id}>! Dedikasi dan keaktifan Anda telah diakui oleh sistem. Anda telah naik ke **Level ${user.level}**.\n\nSistem telah menyuntikkan bonus **+500 Gold** ke saldo Anda.`)
                    .setThumbnail(message.author.displayAvatarURL())
                    .setFooter({ text: 'Sistem Pemantauan Otomatis Amamiya' });

                await message.channel.send({ embeds: [levelUpEmbed] });
            }

            await user.save();

        } catch (error) {
            console.error("Kesalahan Basis Data pada messageCreate:", error);
        }
    },
};