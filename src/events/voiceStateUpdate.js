const { EmbedBuilder } = require('discord.js');
const User = require('../models/User'); 

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const client = newState.client;
        const member = newState.member;

        // 1. Validasi Entitas Mutlak: Abaikan bot (termasuk bot radio itu sendiri)
        if (member.user.bot) return;

        if (!client.voiceJoinTimes) {
            client.voiceJoinTimes = new Map();
        }

        // --- KONDISI A: PENGGUNA MASUK ATAU AKTIF DI VC ---
        if (!oldState.channelId && newState.channelId) {
            // Cek jika pengguna masuk tapi langsung Deafen (Tuli) atau masuk ke channel AFK bawaan Discord
            if (newState.selfDeaf || newState.serverDeaf || (newState.guild.afkChannelId === newState.channelId)) {
                return; // Jangan mulai stopwatch
            }
            client.voiceJoinTimes.set(member.id, Date.now());
            return;
        }

        // --- KONDISI B: PENGGUNA BERUBAH STATUS DI DALAM VC ---
        // Jika mereka di dalam VC, lalu tiba-tiba Deafen (Tuli) atau dipindah ke channel AFK
        if (oldState.channelId && newState.channelId) {
            if ((!oldState.selfDeaf && newState.selfDeaf) || (newState.guild.afkChannelId === newState.channelId)) {
                // Anggap mereka keluar dari VC untuk menghentikan sesi
                oldState.channelId = oldState.channelId; 
                newState.channelId = null; 
            } else if (oldState.selfDeaf && !newState.selfDeaf) {
                // Mereka kembali mendengar (Undeafen), mulai ulang stopwatch dari nol
                client.voiceJoinTimes.set(member.id, Date.now());
                return;
            } else {
                return; // Perubahan lain (seperti mute mic, open cam) diabaikan
            }
        }

        // --- KONDISI C: PENGGUNA KELUAR DARI VC (ATAU TERKENA KONDISI B DI ATAS) ---
        if (oldState.channelId && !newState.channelId) {
            const joinTime = client.voiceJoinTimes.get(member.id);
            if (!joinTime) return;

            const leaveTime = Date.now();
            const durationMs = leaveTime - joinTime;
            let durationMinutes = Math.floor(durationMs / 60000);

            client.voiceJoinTimes.delete(member.id);

            // 2. Filter Anti-Spam: Minimal 1 menit
            if (durationMinutes < 1) return;

            // 3. HARD CAP (BATAS MAKSIMAL): 4 Jam (240 Menit) per sesi
            let isCapped = false;
            if (durationMinutes > 240) {
                durationMinutes = 240;
                isCapped = true;
            }

            // Kalkulasi XP: 2 XP per menit
            const xpEarned = durationMinutes * 2;

            try {
                let user = await User.findOne({ userId: member.id });
                if (!user) {
                    user = new User({
                        userId: member.id, username: member.user.username,
                        xp: 0, level: 1, gold: 1000, inventory: [], totalStudy: 0
                    });
                }

                user.totalStudy += durationMinutes;
                user.xp += xpEarned;

                const xpRequired = user.level * 150;
                let levelUpMsg = "";
                if (user.xp >= xpRequired) {
                    user.level += 1;
                    user.gold += 500;
                    levelUpMsg = `\n🎉 **LEVEL UP!** Anda naik ke **Level ${user.level}**. Sistem menyuntikkan bonus **+500 Gold**!`;
                }

                await user.save();

                // --- PENGIRIMAN FAKTUR ---
                try {
                    const reportEmbed = new EmbedBuilder()
                        .setColor('#3498DB') 
                        .setTitle('📚 Laporan Sesi Belajar Selesai')
                        .setDescription(`Sistem Amamiya telah mencatat aktivitas Anda di saluran suara.`)
                        .addFields(
                            { name: '⏱️ Durasi Sesi', value: `${durationMinutes} Menit`, inline: true },
                            { name: '✨ XP Diperoleh', value: `+${xpEarned} XP`, inline: true },
                            { name: '📊 Total Waktu', value: `${Math.floor(user.totalStudy / 60)} Jam ${user.totalStudy % 60} Menit`, inline: false }
                        )
                        .setFooter({ text: 'Sistem Anti-AFK Amamiya beroperasi.' })
                        .setTimestamp();

                    if (isCapped) {
                        reportEmbed.addFields({ name: '⚠️ Peringatan Sistem', value: 'Sesi Anda melebihi batas maksimal 4 jam. Sistem secara otomatis memotong durasi untuk mencegah kelelahan medis dan eksploitasi sistem.', inline: false });
                    }
                    if (levelUpMsg) {
                        reportEmbed.addFields({ name: 'Pencapaian Baru', value: levelUpMsg, inline: false });
                    }

                    await member.send({ embeds: [reportEmbed] });
                } catch (dmError) {
                    // Abaikan jika DM dikunci
                }

            } catch (error) {
                console.error("Kesalahan Pangkalan Data:", error);
            }
        }
    },
};