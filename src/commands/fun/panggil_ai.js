const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { GoogleGenAI } = require('@google/genai'); // SDK Baru
const { MilvusClient } = require("@zilliz/milvus2-sdk-node");

// Model Database
const User = require('../../models/User'); // Sesuaikan path jika berbeda
const Notebook = require('../../models/Notebook'); // Sesuaikan path jika berbeda

// Inisialisasi Klien
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const milvusClient = new MilvusClient({ address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`, ssl: false });

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
        .setDescription('Panggil asisten VTuber AI ke Voice Channel'),

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
            if (userId === interaction.user.id) {
                console.log(`[AUDIO] Merekam suara ${interaction.user.username}...`);

                const audioStream = receiver.subscribe(userId, {
                    end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 },
                });

                audioStream.on('error', (err) => console.error(`⚠️ [AUDIO STREAM] Error:`, err.message));

                const decoder = new prism.opus.Decoder({ rate: 48000, channels: 1, frameSize: 960 });
                const pcmStream = audioStream.pipe(decoder);
                pcmStream.on('error', (err) => console.error(`⚠️ [PCM DECODER] Error:`, err.message));

                let audioBuffer = [];
                pcmStream.on('data', (chunk) => audioBuffer.push(chunk));

                pcmStream.on('end', async () => {
                    if (audioBuffer.length === 0) return;

                    const finalPcmBuffer = Buffer.concat(audioBuffer);
                    const wavHeader = getWavHeader(finalPcmBuffer.length);
                    const wavBuffer = Buffer.concat([wavHeader, finalPcmBuffer]);
                    const base64Audio = wavBuffer.toString('base64');

                    interaction.client.io.emit('ai_speak', { teks: "*[Sedang mencerna...]*", emosi: "neutral" });

                    try {
                        let konteksGabungan = "";
                        let pertanyaanUser = "";

                        // ==========================================
                        // TAHAP 1A: CEK STATUS BUKU & TRANSKRIPSI (STT)
                        // ==========================================
                        const userProfile = await User.findOne({ userId: interaction.user.id });
                        const activeNotebook = userProfile && userProfile.activeNotebook ? await Notebook.findById(userProfile.activeNotebook) : null;

                        if (activeNotebook && activeNotebook.files.length > 0) {
                            console.log(`[STT] Mengekstrak teks untuk pencarian Milvus...`);
                            
                            // Ekstrak teks dari audio untuk diubah menjadi Vektor
                            const sttResponse = await ai.models.generateContent({
                                model: 'gemini-2.5-flash',
                                contents: [
                                    {
                                        role: 'user',
                                        parts: [
                                            { text: 'Transkrip audio ini menjadi teks secara presisi. Jawab HANYA dengan teks transkripsinya saja.' },
                                            { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
                                        ]
                                    }
                                ]
                            });
                            pertanyaanUser = sttResponse.text;
                            console.log(`[STT HASIL]: "${pertanyaanUser}"`);

                            // ==========================================
                            // TAHAP 1B: PENCARIAN MILVUS (RAG)
                            // ==========================================
                            const hashes = activeNotebook.files.map(f => f.fileHash);
                            
                            // Embed Pertanyaan
                            const embedResult = await ai.models.embedContent({
                                model: 'gemini-embedding-001', // Menggunakan model embedding terbaru
                                contents: pertanyaanUser
                            });
                            const vektorPertanyaan = embedResult.embeddings[0].values;

                            // Cari di Milvus
                            const hashFilter = `fileHash in [${hashes.map(h => `"${h}"`).join(',')}]`;
                            const searchRes = await milvusClient.search({
                                collection_name: "notebook_amamiya",
                                vector: vektorPertanyaan,
                                filter: hashFilter,
                                output_fields: ["text_content", "page_number", "fileHash"],
                                limit: 3 // Ambil 3 konteks teratas agar respon AI tetap cepat
                            });

                            if (searchRes.results.length > 0) {
                                searchRes.results.forEach((res) => {
                                    konteksGabungan += `[Hal: ${res.page_number}]\n${res.text_content}\n\n`;
                                });
                                console.log(`✅ [MILVUS] Konteks referensi berhasil ditarik.`);
                            }
                        }

                        // ==========================================
                        // TAHAP 2: OTAK (LOGIKA & EMOSI)
                        // ==========================================
                        console.log(`[GEMINI OTAK] Menganalisis respon...`);
                        
                        let promptOtak = 'Dengarkan suara ini. Balas sebagai asisten VTuber medis yang cerdas dan imut. Jawab singkat maksimal 2 kalimat. Balas WAJIB dalam format JSON murni: {"teks": "jawabanmu", "emosi": "happy/sad/angry/neutral/surprised", "gaya_bicara": "deskripsi singkat gaya bicara untuk TTS, misal: ceria dan antusias"}';

                        // Injeksi konteks Milvus jika ada
                        if (konteksGabungan !== "") {
                            promptOtak = `Berikut adalah referensi medis dari buku catatan pengguna:\n${konteksGabungan}\n\nBerdasarkan audio pertanyaan pengguna dan referensi medis di atas, balas sebagai asisten VTuber medis yang presisi. Jawab singkat maksimal 2 kalimat. Balas WAJIB dalam format JSON murni: {"teks": "jawabanmu", "emosi": "happy/sad/angry/neutral/surprised", "gaya_bicara": "deskripsi singkat gaya bicara untuk TTS"}`;
                        }

                        const responseLLM = await ai.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: promptOtak },
                                        { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
                                    ]
                                }
                            ],
                            config: { responseMimeType: "application/json" }
                        });

                        const hasilLogika = JSON.parse(responseLLM.text);
                        console.log(`✅ [HASIL OTAK]:`, hasilLogika);

                        // ==========================================
                        // TAHAP 3: MULUT (TTS)
                        // ==========================================
                        console.log(`[GEMINI TTS] Merender suara...`);
                        const responseTTS = await ai.models.generateContent({
                            model: 'gemini-2.5-flash-preview-tts',
                            contents: `
                            # AUDIO PROFILE: Amamiya
                            Asisten VTuber medis yang cerdas.
                            
                            ### DIRECTOR'S NOTES
                            Style: ${hasilLogika.gaya_bicara}
                            Accent: Indonesian.
                            
                            #### TRANSCRIPT
                            ${hasilLogika.teks}
                            `,
                            config: {
                                responseModalities: ["AUDIO"],
                                speechConfig: {
                                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
                                }
                            }
                        });

                        const audioData = responseTTS.candidates[0].content.parts[0].inlineData.data;
                        console.log(responseTTS.candidates[0].content.parts[0].inlineData.mimeType);
                        // ==========================================
                        // TAHAP 4: KIRIM KE BROWSER
                        // ==========================================
                        interaction.client.io.emit('ai_speak', {
                            teks: hasilLogika.teks,
                            emosi: hasilLogika.emosi,
                            audioData: audioData
                        });

                    } catch (error) {
                        console.error('❌ [GEMINI/MILVUS ERROR]:', error);
                        interaction.client.io.emit('ai_speak', {
                            teks: "*[Sistem database atau kognitifku sedang bermasalah]*",
                            emosi: "sad"
                        });
                    }
                });
            }
        });
    }
};