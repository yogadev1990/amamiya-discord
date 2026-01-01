const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User'); // Pastikan path ke model user.js benar

module.exports = {
    name: 'fokus',
    description: 'Timer belajar Pomodoro (Wajib masuk Voice Channel)',
    async execute(message, args) {
        
        // 1. VALIDASI: Fetch Member Terbaru (Biar gak kena cache lama)
        let member;
        try {
            // Kita paksa ambil data member terbaru dari Discord langsung
            member = await message.guild.members.fetch(message.author.id);
        } catch (error) {
            return message.reply("❌ Gagal mengambil data user. Coba lagi.");
        }

        // Cek Voice Channel dari member yang baru di-fetch
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply("❌ **Akses Ditolak!**\nMasuk ke **Voice Channel** (Ruang Baca - Perpustakaan Digital) dulu biar valid.");
        }


        // 2. Setup Waktu
        let duration = parseInt(args[0]);
        if (!duration || isNaN(duration)) duration = 25; 
        if (duration < 5) return message.reply("❌ Kecepetan! Minimal 5 menit.");
        if (duration > 180) return message.reply("❌ Kelamaan! Maksimal 3 jam.");

        // Hitung Timestamp
        const endTime = new Date(Date.now() + duration * 60000);
        const timestamp = Math.floor(endTime.getTime() / 1000);

        // 3. Pesan Mulai
        const embedStart = new EmbedBuilder()
            .setColor(0xF1C40F) // Kuning
            .setTitle('🍅 POMODORO STARTED')
            .setDescription(`**${message.author.username}** mulai belajar di ruang **${voiceChannel.name}**.\nDurasi: **${duration} menit**`)
            .addFields(
                { name: 'Selesai pada', value: `<t:${timestamp}:t>`, inline: true },
                { name: '⚠️ Aturan', value: 'Jangan keluar Voice Channel atau Reward Hangus!', inline: false }
            )
            .setFooter({ text: 'Amamiya KG UNSRI' });

        await message.reply({ embeds: [embedStart] });

        // 4. TIMER BERJALAN
        setTimeout(async () => {
            // Fetch kondisi member TERBARU (Cek apakah masih di VC)
            let currentMember;
            try {
                currentMember = await message.guild.members.fetch(message.author.id);
            } catch (e) { return; } // User leave server

            const currentVoiceChannel = currentMember.voice.channel;

            // --- KONDISI GAGAL (BOLOS) ---
            if (!currentVoiceChannel || currentVoiceChannel.id !== voiceChannel.id) {
                const embedFail = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setTitle('❌ SESI GAGAL')
                    .setDescription(`Halo **${message.author.username}**, kamu tidak ditemukan di ruang belajar.\n🚫 **Reward XP & Gold Hangus.**`)
                    .setTimestamp();
                
                try { await message.author.send({ embeds: [embedFail] }); } 
                catch (e) { await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embedFail] }); }
                return;
            }

            // --- KONDISI SUKSES (RAJIN) ---
            try {
                // A. Cari User di MongoDB
                let user = await User.findOne({ userId: message.author.id });
                
                // B. Kalau user belum terdaftar, buat baru
                if (!user) {
                    user = new User({
                        userId: message.author.id,
                        username: message.author.username,
                        gold: 1000,
                        xp: 0,
                        level: 1
                    });
                }

                // C. Hitung Reward
                const goldEarned = duration * 10;
                const xpEarned = duration * 5;

                // D. Update Database
                user.gold += goldEarned;
                user.xp += xpEarned;
                
                // Cek field totalStudy (jika kamu menambahkannya di schema)
                if (user.totalStudy !== undefined) {
                    user.totalStudy += duration;
                }

                // E. Logika Level Up Sederhana (Tiap 500 XP naik level)
                const nextLevelXp = user.level * 500;
                let levelUpMsg = "";
                if (user.xp >= nextLevelXp) {
                    user.level += 1;
                    levelUpMsg = `\n🆙 **LEVEL UP!** Kamu naik ke Level ${user.level}!`;
                }

                await user.save(); // Simpan ke MongoDB

                // F. Kirim Notif Sukses
                const embedSuccess = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('✅ SESI SELESAI!')
                    .setDescription(`Kerja bagus **${message.author.username}**! Fokus ${duration} menit tuntas.`)
                    .addFields({ 
                        name: '🎁 Reward Cair', 
                        value: `+${goldEarned} 🪙 Gold\n+${xpEarned} ✨ XP${levelUpMsg}\n\n*Saldo sekarang: ${user.gold} Gold*` 
                    })
                    .setTimestamp();

                try { await message.author.send({ embeds: [embedSuccess] }); } 
                catch (e) { await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embedSuccess] }); }

            } catch (err) {
                console.error("Database Error:", err);
            }

        }, duration * 60000);
    },
};