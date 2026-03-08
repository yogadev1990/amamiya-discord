const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');

// 1. Panggil SDK baru Google Gen AI
const { GoogleGenAI } = require('@google/genai');
// Pastikan variabel GEMINI_API_KEY sudah terisi di file .env kamu
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); 

// Fungsi rahasia untuk menyulap Raw PCM menjadi WAV di dalam RAM (0 Latensi)
function getWavHeader(pcmLength, sampleRate = 48000, channels = 1, bitsPerSample = 16) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmLength, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
    header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmLength, 40);
    return header;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panggil_ai')
        .setDescription('Panggil avatar AI ke Voice Channel untuk ngobrol'),

    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Masuk ke Voice Channel dulu!', ephemeral: true });
        }

        await interaction.reply('🎙️ AI sudah siap mendengar di Voice Channel...');

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false 
        });

        const receiver = connection.receiver;

        receiver.speaking.on('start', (userId) => {
            // Hanya merespons user yang memanggil command ini
            if (userId === interaction.user.id) {
                console.log(`[AUDIO] Merekam suara ${interaction.user.username}...`);

                const audioStream = receiver.subscribe(userId, {
                    end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 },
                });

                // PENGAMAN: Mencegah crash jika ada paket audio rusak dari Discord
                audioStream.on('error', (error) => {
                    console.error(`⚠️ [AUDIO STREAM] Paket terabaikan:`, error.message);
                });

                // Discord Opus (Stereo 48kHz) -> PCM (Mono 48kHz)
                const decoder = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });
                const pcmStream = audioStream.pipe(decoder);
                
                // PENGAMAN DEKODER
                pcmStream.on('error', (error) => {
                    console.error(`⚠️ [PCM DECODER] Dekode gagal:`, error.message);
                });

                let audioBuffer = [];
                pcmStream.on('data', (chunk) => audioBuffer.push(chunk));

                pcmStream.on('end', async () => {
                    if (audioBuffer.length === 0) return; 

                    const finalPcmBuffer = Buffer.concat(audioBuffer);
                    
                    // 2. BUNGKUS PCM JADI WAV
                    const wavHeader = getWavHeader(finalPcmBuffer.length);
                    const wavBuffer = Buffer.concat([wavHeader, finalPcmBuffer]);
                    const base64Audio = wavBuffer.toString('base64');

                    console.log(`[GEMINI] Mengirim ${wavBuffer.length} bytes file WAV ke Native API...`);

                    // Kirim sinyal loading ke web
                    interaction.client.io.emit('ai_speak', {
                        teks: "*[Berpikir...]*",
                        emosi: "neutral"
                    });

                    // 3. KIRIM AUDIO LANGSUNG KE GEMINI NATIVE AUDIO
                    try {
                        const response = await ai.models.generateContent({
                            // Pastikan model name sesuai dengan dokumen pratinjau terbaru Google
                            model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: 'Dengarkan suara ini. Balas sebagai asisten VTuber yang ceria dan singkat. WAJIB awali teks balasanmu dengan salah satu tag emosi persis seperti ini: [HAPPY], [SAD], [ANGRY], [SURPRISED], atau [NEUTRAL].' },
                                        { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
                                    ]
                                }
                            ]
                        });

                        // 4. BONGKAR RESPONS DARI GEMINI (Teks + Audio)
                        let teksBalasan = "";
                        let audioBalasanBase64 = "";

                        // Ekstrak teks dan audio dari array of parts
                        const parts = response.candidates[0].content.parts;
                        for (const part of parts) {
                            if (part.text) teksBalasan += part.text;
                            if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
                                audioBalasanBase64 = part.inlineData.data;
                            }
                        }

                        // 5. EKSTRAK KODE EMOSI
                        let emosiFinal = "neutral";
                        let teksFinal = teksBalasan.trim();

                        const match = teksFinal.match(/^\[(.*?)\]/); // Deteksi tag [EMOSI]
                        if (match) {
                            emosiFinal = match[1].toLowerCase();
                            teksFinal = teksFinal.replace(match[0], '').trim(); // Buang tag agar tidak terbaca di subtitle
                        }

                        console.log(`✅ [HASIL AI] Emosi: ${emosiFinal} | Teks: ${teksFinal}`);

                        // 6. KIRIM KE BROWSER WEB!
                        interaction.client.io.emit('ai_speak', {
                            teks: teksFinal,
                            emosi: emosiFinal,
                            audioData: audioBalasanBase64
                        });

                    } catch (error) {
                        console.error('❌ [GEMINI ERROR]:', error);
                        interaction.client.io.emit('ai_speak', {
                            teks: "*[Maaf, API sedang bermasalah atau model tidak tersedia]*",
                            emosi: "sad"
                        });
                    }
                });
            }
        });
    }
};