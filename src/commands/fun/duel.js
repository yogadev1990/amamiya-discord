const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');
const User = require('../../../shared/models/User');

// Tambahkan session lock global di luar module.exports
const activeDuels = new Map();

module.exports = {
    name: 'duel',
    description: 'Tantang temanmu adu kecerdasan KG (Taruhan 200 Gold)',
    async execute(message, args) {
        // Session key: channelId + challengerId + opponentId
        const challenger = message.author;
        const opponent = message.mentions.users.first();
        const sessionKey = `${message.channel.id}:${challenger.id}:${opponent ? opponent.id : 'none'}`;

        // Cek apakah sudah ada duel aktif di channel ini antara dua user
        if (activeDuels.has(sessionKey)) {
            return message.reply('⚠️ Duel antara kalian masih berlangsung. Selesaikan dulu sebelum mulai duel baru!');
        }
        // Tandai duel aktif
        activeDuels.set(sessionKey, true);

        try {
            // --- 1. VALIDASI LAWAN ---
            if (!opponent) return message.reply('⚠️ **Format Salah!** Tag lawanmu.\nContoh: `!duel @Revanda`');
            if (opponent.bot) return message.reply('🤖 Jangan lawan bot, aku terlalu pintar untukmu.');
            if (opponent.id === challenger.id) return message.reply('🪞 Sedang berkaca? Cari lawan yang nyata dong.');

            // --- 2. CEK UANG (EKONOMI) ---
            // Kita gunakan lean() jika hanya butuh membaca, tapi karena mau edit, jangan pakai lean()
            let dataChallenger = await User.findOne({
                userId: challenger.id
            });
            let dataOpponent = await User.findOne({
                userId: opponent.id
            });

            // Buat data baru jika belum ada
            if (!dataChallenger) {
                dataChallenger = await User.create({
                    userId: challenger.id,
                    username: challenger.username,
                    gold: 1000
                });
            }
            if (!dataOpponent) {
                dataOpponent = await User.create({
                    userId: opponent.id,
                    username: opponent.username,
                    gold: 1000
                });
            }

            const TARUHAN = 200;

            if (dataChallenger.gold < TARUHAN) {
                return message.reply(`💸 **Uangmu kurang!** Butuh ${TARUHAN} Gold. (Saldomu: ${dataChallenger.gold})`);
            }
            if (dataOpponent.gold < TARUHAN) {
                return message.reply(`💸 **${opponent.username} miskin!** Dia cuma punya ${dataOpponent.gold} Gold.`);
            }

            // --- 3. KIRIM UNDANGAN DUEL ---
            const embedInvite = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('⚔️ DENTAL DUEL CHALLENGE')
                .setDescription(`**${challenger.username}** menantang **${opponent.username}**!\n\n💰 **Taruhan:** ${TARUHAN} Gold\n🧠 **Topik:** Kedokteran Gigi Umum\n\n*Siapa cepat & benar, dia yang menang!*`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2821/2821876.png')
                .setFooter({
                    text: 'Menunggu lawan menerima (30 detik)...'
                });

            const btnInvite = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept').setLabel('Gasss! Terima').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('decline').setLabel('Takut ah').setStyle(ButtonStyle.Secondary)
            );

            const msgInvite = await message.channel.send({
                content: `<@${opponent.id}>`,
                embeds: [embedInvite],
                components: [btnInvite]
            });

            // --- 4. TUNGGU RESPON LAWAN ---
            try {
                const confirmation = await msgInvite.awaitMessageComponent({
                    filter: i => i.user.id === opponent.id, // Hanya lawan yang boleh klik
                    time: 30000,
                    componentType: ComponentType.Button
                });

                // LOGIC TOMBOL UNDANGAN
                if (confirmation.customId === 'decline') {
                    await confirmation.update({
                        content: `🏃 **${opponent.username}** menolak tantangan (Mental kerupuk!).`,
                        components: [],
                        embeds: []
                    });
                    return; // Stop eksekusi di sini
                }

                // Jika ACCEPT, langsung update pesan biar tombolnya hilang (mencegah klik ganda)
                await confirmation.update({
                    content: '🔥 **DUEL DITERIMA!**\nSedang meminta soal ke Gemini, mohon tunggu...',
                    components: [],
                    embeds: []
                });

                // --- 5. GENERATE SOAL (GEMINI) ---
                const prompt = `
                Buatkan 1 soal pilihan ganda tingkat SEDANG tentang Ilmu Kedokteran Gigi untuk mahasiswa S1.
                Output WAJIB JSON murni:
                {
                    "soal": "Pertanyaan...",
                    "opsi": { "A": "...", "B": "...", "C": "...", "D": "..." },
                    "kunci": "A"
                }
                `;

                let quizData;
                try {
                    const rawData = await GeminiAi.run(challenger.id, challenger.username, prompt);
                    const cleanJson = rawData.replace(/```json/g, '').replace(/```/g, '').trim();
                    quizData = JSON.parse(cleanJson);
                } catch (err) {
                    console.error('Gemini Error:', err);
                    return message.channel.send('❌ Gagal memuat soal dari Gemini. Coba lagi nanti.');
                }

                // --- TAMPILKAN SOAL ---
                const embedSoal = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle('🥊 FIGHT!')
                    .setDescription(`**${quizData.soal}**\n\n🇦 ${quizData.opsi.A}\n🇧 ${quizData.opsi.B}\n🇨 ${quizData.opsi.C}\n🇩 ${quizData.opsi.D}`)
                    .setFooter({
                        text: 'Klik jawabanmu secepat mungkin!'
                    });

                const btnSoal = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(ButtonStyle.Primary),
                );

                const msgSoal = await message.channel.send({
                    embeds: [embedSoal],
                    components: [btnSoal]
                });

                // --- 6. LOGIKA PERMAINAN (SIAPA CEPAT DIA DAPAT) ---
                const collector = msgSoal.createMessageComponentCollector({
                    filter: i => [challenger.id, opponent.id].includes(i.user.id),
                    time: 30000,
                    max: 1 // Stop setelah 1 jawaban masuk
                });

                collector.on('collect', async interaction => {
                    try {
                        // PENTING: Defer dulu biar gak Interaction Failed
                        await interaction.deferUpdate();

                        const jawabanUser = interaction.customId;
                        const penjawab = interaction.user;
                        const musuh = interaction.user.id === challenger.id ? opponent : challenger;

                        // Fetch data terbaru lagi untuk update saldo
                        const dbPenjawab = await User.findOne({
                            userId: penjawab.id
                        });
                        const dbMusuh = await User.findOne({
                            userId: musuh.id
                        });

                        if (jawabanUser === quizData.kunci) {
                            // --- MENANG ---
                            dbPenjawab.gold += TARUHAN;
                            dbMusuh.gold -= TARUHAN;
                            dbPenjawab.xp += 150;

                            await dbPenjawab.save();
                            await dbMusuh.save();

                            const winEmbed = new EmbedBuilder()
                                .setColor(0x2ECC71)
                                .setTitle(`👑 PEMENANG: ${penjawab.username}!`)
                                .setDescription(`Jawaban Benar: **${quizData.kunci}**\n\n💰 **+${TARUHAN} Gold** (Total: ${dbPenjawab.gold})\n✨ **+150 XP**\n\n💀 **${musuh.username}** kehilangan ${TARUHAN} Gold.`)
                                .setThumbnail(penjawab.displayAvatarURL());

                            await msgSoal.edit({
                                embeds: [winEmbed],
                                components: []
                            });

                        } else {
                            // --- SALAH (BLUNDER) ---
                            dbPenjawab.gold -= TARUHAN;
                            dbMusuh.gold += TARUHAN;
                            dbMusuh.xp += 150;

                            await dbPenjawab.save();
                            await dbMusuh.save();

                            const loseEmbed = new EmbedBuilder()
                                .setColor(0xE74C3C)
                                .setTitle(`💀 BLUNDER! ${penjawab.username} SALAH!`)
                                .setDescription(`Jawaban yang dipilih: **${jawabanUser}** (Salah)\nKunci Jawaban: **${quizData.kunci}**\n\nKarena salah, **${musuh.username}** otomatis MENANG!\n\n💰 **${musuh.username}** dapat +${TARUHAN} Gold.`)
                                .setThumbnail(musuh.displayAvatarURL());

                            await msgSoal.edit({
                                embeds: [loseEmbed],
                                components: []
                            });
                        }
                    } catch (error) {
                        console.error('Error processing answer:', error);
                        interaction.followUp({
                            content: '❌ Error sistem saat memproses jawaban.',
                            ephemeral: true
                        });
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        msgSoal.edit({
                            content: '⌛ **Waktu Habis!** Duel dibatalkan karena kalian lambat.',
                            components: [],
                            embeds: []
                        });
                    }
                    activeDuels.delete(sessionKey);
                });

            } catch (e) {
                // Error handling untuk Invite Timeout (Lawan gak klik apa-apa)
                // Error code interaction collector timeout biasanya beda, tapi kita handle umum aja
                console.log('Duel invite timeout or error:', e.message);
                msgInvite.edit({
                    content: '❌ Tantangan kadaluarsa. Lawan tidak merespon dalam 30 detik.',
                    components: [],
                    embeds: []
                }).catch(() => {}); // Catch error kalau pesan aslinya udah kehapus
            }
        } catch (err) {
            activeDuels.delete(sessionKey);
            throw err;
        }
    },
};
