const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panggil_ai')
        .setDescription('Panggil avatar AI ke Voice Channel untuk ngobrol'),

    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        // Validasi: User harus di VC dulu
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Kamu harus masuk ke Voice Channel dulu!', ephemeral: true });
        }

        await interaction.reply('🎙️ Meluncur ke Voice Channel! Coba bicara sesuatu...');

        // 1. Bot Join ke VC
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false // WAJIB FALSE agar bot bisa mendengar suaramu
        });

        const receiver = connection.receiver;

        // 2. Deteksi saat ada yang mulai berbicara
        receiver.speaking.on('start', (userId) => {
            // Hanya dengarkan user yang memanggil command ini
            if (userId === interaction.user.id) {
                console.log(`[AUDIO] Mulai merekam suara ${interaction.user.username}...`);

                // 3. Tangkap aliran audio (Opus Stream)
                const audioStream = receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 1500, 
                    },
                });

                // ==========================================
                // WAJIB ADA: Pengaman agar bot kebal crash
                // ==========================================
                audioStream.on('error', (error) => {
                    console.error(`⚠️ [AUDIO STREAM] Paket rusak dari user, abaikan:`, error.message);
                });

                // 4. Ubah format audio Discord (Opus) ke format mentah (PCM)
                const decoder = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });
                const pcmStream = audioStream.pipe(decoder);

                // ==========================================
                // WAJIB ADA: Pengaman dekoder
                // ==========================================
                pcmStream.on('error', (error) => {
                    console.error(`⚠️ [PCM DECODER] Gagal decode audio:`, error.message);
                });

                let audioBuffer = [];
                pcmStream.on('data', (chunk) => {
                    audioBuffer.push(chunk);
                });

                // 5. Eksekusi saat user selesai bicara (diam 1.5 detik)
                pcmStream.on('end', () => {
                    if (audioBuffer.length === 0) return; // Abaikan jika buffer kosong karena error

                    const finalBuffer = Buffer.concat(audioBuffer);
                    console.log(`[AUDIO] Selesai merekam. Total ukuran PCM: ${finalBuffer.length} bytes`);

                    interaction.client.io.emit('ai_speak', {
                        teks: "*[Sedang mencerna ucapanmu...]*",
                        emosi: "neutral"
                    });
                    
                });
            }
        });
    }
};