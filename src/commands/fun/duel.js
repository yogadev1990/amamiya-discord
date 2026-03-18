const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');
const User = require('../../shared/models/User');

const activeDuels = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Tantang temanmu adu kecerdasan KG (Taruhan 200 Gold)')
        .addUserOption(option => 
            option.setName('lawan')
                .setDescription('Pilih teman yang ingin ditantang')
                .setRequired(true)
        ),
    async execute(interaction) {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('lawan');
        const sessionKey = `${interaction.channelId}:${challenger.id}:${opponent ? opponent.id : 'none'}`;

        if (activeDuels.has(sessionKey)) {
            return interaction.reply({ content: '⚠️ Duel antara kalian masih berlangsung. Selesaikan dulu sebelum mulai duel baru!', ephemeral: true });
        }
        activeDuels.set(sessionKey, true);

        try {
            if (!opponent) return interaction.reply({ content: '⚠️ **Format Salah!** Tag lawanmu.', ephemeral: true });
            if (opponent.bot) return interaction.reply({ content: '🤖 Jangan lawan bot, aku terlalu pintar untukmu.', ephemeral: true });
            if (opponent.id === challenger.id) return interaction.reply({ content: '🪞 Sedang berkaca? Cari lawan yang nyata dong.', ephemeral: true });

            let dataChallenger = await User.findOne({ userId: challenger.id });
            let dataOpponent = await User.findOne({ userId: opponent.id });

            if (!dataChallenger) {
                dataChallenger = await User.create({ userId: challenger.id, username: challenger.username, gold: 1000 });
            }
            if (!dataOpponent) {
                dataOpponent = await User.create({ userId: opponent.id, username: opponent.username, gold: 1000 });
            }

            const TARUHAN = 200;

            if (dataChallenger.gold < TARUHAN) {
                return interaction.reply({ content: `💸 **Uangmu kurang!** Butuh ${TARUHAN} Gold. (Saldomu: ${dataChallenger.gold})`, ephemeral: true });
            }
            if (dataOpponent.gold < TARUHAN) {
                return interaction.reply({ content: `💸 **${opponent.username} miskin!** Dia cuma punya ${dataOpponent.gold} Gold.`, ephemeral: true });
            }

            const embedInvite = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('⚔️ DENTAL DUEL CHALLENGE')
                .setDescription(`**${challenger.username}** menantang **${opponent.username}**!\n\n💰 **Taruhan:** ${TARUHAN} Gold\n🧠 **Topik:** Kedokteran Gigi Umum\n\n*Siapa cepat & benar, dia yang menang!*`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2821/2821876.png')
                .setFooter({ text: 'Menunggu lawan menerima (30 detik)...' });

            const btnInvite = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept').setLabel('Gasss! Terima').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('decline').setLabel('Takut ah').setStyle(ButtonStyle.Secondary)
            );

            const msgInvite = await interaction.reply({
                content: `<@${opponent.id}>`,
                embeds: [embedInvite],
                components: [btnInvite],
                fetchReply: true
            });

            try {
                const confirmation = await msgInvite.awaitMessageComponent({
                    filter: i => i.user.id === opponent.id,
                    time: 30000,
                    componentType: ComponentType.Button
                });

                if (confirmation.customId === 'decline') {
                    await confirmation.update({
                        content: `🏃 **${opponent.username}** menolak tantangan (Mental kerupuk!).`,
                        components: [],
                        embeds: []
                    });
                    activeDuels.delete(sessionKey);
                    return;
                }

                await confirmation.update({
                    content: '🔥 **DUEL DITERIMA!**\nSedang meminta soal ke Gemini, mohon tunggu...',
                    components: [],
                    embeds: []
                });

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
                    return interaction.channel.send('❌ Gagal memuat soal dari Gemini. Coba lagi nanti.');
                }

                const embedSoal = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle('🥊 FIGHT!')
                    .setDescription(`**${quizData.soal}**\n\n🇦 ${quizData.opsi.A}\n🇧 ${quizData.opsi.B}\n🇨 ${quizData.opsi.C}\n🇩 ${quizData.opsi.D}`)
                    .setFooter({ text: 'Klik jawabanmu secepat mungkin!' });

                const btnSoal = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('A').setLabel('A').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('B').setLabel('B').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('C').setLabel('C').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('D').setLabel('D').setStyle(ButtonStyle.Primary),
                );

                const msgSoal = await interaction.channel.send({
                    embeds: [embedSoal],
                    components: [btnSoal]
                });

                const collector = msgSoal.createMessageComponentCollector({
                    filter: i => [challenger.id, opponent.id].includes(i.user.id),
                    time: 30000,
                    max: 1
                });

                collector.on('collect', async interact => {
                    try {
                        await interact.deferUpdate();

                        const jawabanUser = interact.customId;
                        const penjawab = interact.user;
                        const musuh = interact.user.id === challenger.id ? opponent : challenger;

                        const dbPenjawab = await User.findOne({ userId: penjawab.id });
                        const dbMusuh = await User.findOne({ userId: musuh.id });

                        if (jawabanUser === quizData.kunci) {
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
                        interact.followUp({ content: '❌ Error sistem saat memproses jawaban.', ephemeral: true });
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
                console.log('Duel invite timeout or error:', e.message);
                interaction.editReply({
                    content: '❌ Tantangan kadaluarsa. Lawan tidak merespon dalam 30 detik.',
                    components: [],
                    embeds: []
                }).catch(() => {});
            }
        } catch (err) {
            activeDuels.delete(sessionKey);
            console.error(err);
        }
    },
};
