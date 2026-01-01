const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const GeminiAi = require('../../utils/geminiHelper');
const User = require('../../models/User');

module.exports = {
    name: 'duel',
    description: 'Tantang temanmu adu kecerdasan KG (Taruhan 200 Gold)',
    async execute(message, args) {
        // --- 1. VALIDASI LAWAN ---
        const challenger = message.author;
        const opponent = message.mentions.users.first();

        if (!opponent) return message.reply('⚠️ **Format Salah!** Tag lawanmu.\nContoh: `!duel @Revanda`');
        if (opponent.bot) return message.reply('🤖 Jangan lawan bot, aku terlalu pintar untukmu.');
        if (opponent.id === challenger.id) return message.reply('🪞 Sedang berkaca? Cari lawan yang nyata dong.');

        // --- 2. CEK UANG (EKONOMI) ---
        // Kita butuh data database kedua pemain untuk cek saldo
        let dataChallenger = await User.findOne({ userId: challenger.id });
        let dataOpponent = await User.findOne({ userId: opponent.id });

        // Buat data baru jika belum ada
        if (!dataChallenger) dataChallenger = await User.create({ userId: challenger.id, username: challenger.username, gold: 1000 });
        if (!dataOpponent) dataOpponent = await User.create({ userId: opponent.id, username: opponent.username, gold: 1000 });

        const TARUHAN = 200;

        if (dataChallenger.gold < TARUHAN) {
            return message.reply(`💸 **Uangmu kurang!** Butuh ${TARUHAN} Gold untuk duel. (Saldomu: ${dataChallenger.gold})`);
        }
        if (dataOpponent.gold < TARUHAN) {
            return message.reply(`💸 **${opponent.username} miskin!** Dia cuma punya ${dataOpponent.gold} Gold. Suruh dia !daily dulu.`);
        }

        // --- 3. KIRIM UNDANGAN DUEL ---
        const embedInvite = new EmbedBuilder()
            .setColor(0xE74C3C) // Merah Tegang
            .setTitle('⚔️ DENTAL DUEL CHALLENGE')
            .setDescription(`**${challenger.username}** menantang **${opponent.username}**!\n\n💰 **Taruhan:** ${TARUHAN} Gold\n🧠 **Topik:** Kedokteran Gigi Umum\n\n*Siapa cepat & benar, dia yang menang!*`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2821/2821876.png') // Ikon pedang silang
            .setFooter({ text: 'Menunggu lawan menerima...' });

        const btnInvite = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept').setLabel('Gasss! Terima').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('decline').setLabel('Takut ah').setStyle(ButtonStyle.Secondary)
        );

        const msgInvite = await message.channel.send({ content: `<@${opponent.id}>`, embeds: [embedInvite], components: [btnInvite] });

        // --- 4. TUNGGU RESPON LAWAN ---
        try {
            const confirmation = await msgInvite.awaitMessageComponent({
                filter: i => i.user.id === opponent.id, // Hanya lawan yang boleh klik
                time: 30000, // 30 detik batas waktu terima
                componentType: ComponentType.Button
            });

            if (confirmation.customId === 'decline') {
                return confirmation.update({ content: `🏃 **${opponent.username}** menolak tantangan (Mental kerupuk!).`, components: [], embeds: [] });
            }

            // Jika DITERIMA
            await confirmation.update({ 
                content: '🔥 **DUEL DITERIMA!**\nSedang menyusun soal, bersiaplah...', 
                components: [], 
                embeds: [] 
            });

            // --- 5. GENERATE SOAL (GEMINI) ---
            const prompt = `
            Buatkan 1 soal pilihan ganda SULIT/HOTS tentang Ilmu Kedokteran Gigi (Klinis, Anatomi, atau Farmakologi).
            
            Output WAJIB JSON murni tanpa markdown:
            {
                "soal": "Pertanyaan...",
                "opsi": {
                    "A": "Jawaban A",
                    "B": "Jawaban B",
                    "C": "Jawaban C",
                    "D": "Jawaban D"
                },
                "kunci": "A" (Hanya satu huruf A/B/C/D)
            }
            `;

            let rawData;
            try {
                rawData = await GeminiAi.run(challenger.id, challenger.username, prompt);
                // Bersihkan Markdown JSON kalau ada
                const cleanJson = rawData.replace(/```json/g, '').replace(/```/g, '').trim();
                const quizData = JSON.parse(cleanJson);

                // TAMPILKAN SOAL
                const embedSoal = new EmbedBuilder()
                    .setColor(0xF1C40F) // Kuning Emas
                    .setTitle('🥊 FIGHT!')
                    .setDescription(`**${quizData.soal}**\n\n🇦 ${quizData.opsi.A}\n🇧 ${quizData.opsi.B}\n🇨 ${quizData.opsi.C}\n🇩 ${quizData.opsi.D}`)
                    .setFooter({ text: 'Klik jawabanmu secepat mungkin!' });

                const btnSoal = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(ButtonStyle.Primary),
                );

                const msgSoal = await message.channel.send({ embeds: [embedSoal], components: [btnSoal] });

                // --- 6. LOGIKA PERMAINAN (SIAPA CEPAT DIA DAPAT) ---
                const collector = msgSoal.createMessageComponentCollector({
                    filter: i => [challenger.id, opponent.id].includes(i.user.id), // Hanya 2 petarung
                    time: 60000, // Waktu jawab 20 detik
                    max: 1 // Collector berhenti setelah ada 1 orang menekan tombol
                });

                collector.on('collect', async interaction => {
                    const jawabanUser = interaction.customId;
                    const penjawab = interaction.user;
                    const musuh = interaction.user.id === challenger.id ? opponent : challenger;
                    
                    // Logic Database Update
                    // Kita fetch ulang biar datanya paling update
                    const dbPenjawab = await User.findOne({ userId: penjawab.id });
                    const dbMusuh = await User.findOne({ userId: musuh.id });

                    if (jawabanUser === quizData.kunci) {
                        // --- MENANG ---
                        // Transfer Uang
                        dbPenjawab.gold += TARUHAN; // Balik modal + Untung (Total +200 dari saldo awal sblm game, tapi disini logikanya +200 dari musuh)
                        dbMusuh.gold -= TARUHAN;
                        
                        // Tambah XP
                        dbPenjawab.xp += 150; 
                        
                        await dbPenjawab.save();
                        await dbMusuh.save();

                        const winEmbed = new EmbedBuilder()
                            .setColor(0x2ECC71) // Hijau
                            .setTitle(`👑 PEMENANG: ${penjawab.username}!`)
                            .setDescription(`Jawaban Benar: **${quizData.kunci}**\n\n💰 **+${TARUHAN} Gold** (Total: ${dbPenjawab.gold})\n✨ **+150 XP**\n\n💀 **${musuh.username}** kehilangan ${TARUHAN} Gold.`)
                            .setThumbnail(penjawab.displayAvatarURL());

                        await interaction.update({ embeds: [winEmbed], components: [] });

                    } else {
                        // --- SALAH (BLUNDER) ---
                        // Kalau penjawab salah, musuh otomatis menang
                        dbPenjawab.gold -= TARUHAN;
                        dbMusuh.gold += TARUHAN;
                        dbMusuh.xp += 150;

                        await dbPenjawab.save();
                        await dbMusuh.save();

                        const loseEmbed = new EmbedBuilder()
                            .setColor(0xE74C3C) // Merah
                            .setTitle(`💀 BLUNDER! ${penjawab.username} SALAH!`)
                            .setDescription(`Jawaban yang dipilih: **${jawabanUser}** (Salah)\nKunci Jawaban: **${quizData.kunci}**\n\nKarena salah, **${musuh.username}** otomatis MENANG!\n\n💰 **${musuh.username}** dapat +${TARUHAN} Gold.`)
                            .setThumbnail(musuh.displayAvatarURL());

                        await interaction.update({ embeds: [loseEmbed], components: [] });
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        msgSoal.edit({ content: '⌛ **Waktu Habis!** Kalian berdua payah, tidak ada yang menjawab.', components: [], embeds: [] });
                    }
                });

            } catch (err) {
                console.error(err);
                message.channel.send('❌ Gagal memuat soal. Kemungkinan Gemini lagi pusing.');
            }

        } catch (e) {
            // Error handling untuk invite (Waktu habis/dicancel)
            msgInvite.edit({ content: '❌ Tantangan kadaluarsa. Lawan tidak merespon.', components: [], embeds: [] });
        }
    },
};