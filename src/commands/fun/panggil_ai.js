const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { GoogleGenAI, Modality, Type } = require('@google/genai');
const fs = require("fs");
const path = require("path");
const { MilvusClient } = require("@zilliz/milvus2-sdk-node");

// DATABASE
const User = require('../../models/User');
const Notebook = require('../../models/Notebook');

// INIT CLIENTS
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const milvusClient = new MilvusClient({
    address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`,
    ssl: false
});

// ===============================
// WAV HEADER GENERATOR (Disesuaikan untuk Output Gemini 24kHz)
// ===============================
function getWavHeader(pcmLength, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
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

// ===============================
// DEKLARASI ALAT (MILVUS TOOL)
// ===============================
const searchMedicalTool = {
    functionDeclarations: [{
        name: "search_medical_reference",
        description: "Cari data, teori, atau referensi medis kedokteran gigi dari jurnal/buku pengguna berdasarkan kata kunci.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "Kata kunci pencarian spesifik (contoh: 'radiografi periapikal', 'Iannucci')"
                }
            },
            required: ["query"]
        }
    }]
};

// ===============================
// COMMAND UTAMA
// ===============================
module.exports = {
    data: new SlashCommandBuilder()
        .setName('panggil_ai')
        .setDescription('Panggil asisten VTuber Amamiya (Real-time Live API)'),

    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Masuk ke Voice Channel dulu!', ephemeral: true });
        }

        await interaction.reply('🎙️ Menginisiasi koneksi satelit real-time ke otak Amamiya...');

        // 1. KONEKSI VOICE DISCORD
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false
        });
        const receiver = connection.receiver;

        // 2. KONEKSI GEMINI LIVE API (WEBSOCKET)
        let session;
        let currentAudioChunks = []; // Penampung potongan suara dari AI
        let currentTextChunks = [];  // Penampung transkrip subtitle untuk frontend
        let activeImages = []; // Penampung gambar referensi

        try {
            session = await ai.live.connect({
                model: 'models/gemini-2.5-flash-native-audio', // Model khusus audio real-time
                config: {
                    tools: [searchMedicalTool],
                    // Modality ditambahkan TEXT agar main.js tetap menerima subtitle
                    responseModalities: [Modality.AUDIO, Modality.TEXT], 
                    systemInstruction: {
                        parts: [{ text: "Kamu adalah Amamiya, VTuber asisten medis cerdas di Fakultas Kedokteran Gigi. Jawab secara instan. Jika butuh referensi medis/teori pasti, gunakan tool search_medical_reference." }]
                    },
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Despina' } }
                    }
                }
            });

            console.log("✅ WebSocket Gemini Live Terhubung!");

            // 3. MENANGANI JAWABAN DARI GEMINI (EVENT LISTENER)
            session.receive().then(async function listenLoop() {
                for await (const message of session.receive()) {
                    
                    // A. TANGKAP AUDIO & TEKS
                    if (message.serverContent?.modelTurn?.parts) {
                        for (const part of message.serverContent.modelTurn.parts) {
                            // Tangkap Audio
                            if (part.inlineData && part.inlineData.data) {
                                currentAudioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
                            }
                            // Tangkap Teks Subtitle
                            if (part.text) {
                                currentTextChunks.push(part.text);
                            }
                        }
                    }

                    // B. TANGKAP PANGGILAN ALAT (MILVUS FUNCTION CALLING)
                    if (message.toolCall) {
                        console.log("🛠️ AI Memanggil Alat Milvus!");
                        const call = message.toolCall.functionCalls[0];
                        
                        if (call.name === "search_medical_reference") {
                            interaction.client.io.emit('ai_speak', { teks: "*[Membuka arsip jurnal medis...]*", emosi: "neutral" });
                            
                            const query = call.args.query;
                            let hasilPencarian = "Data tidak ditemukan di database.";
                            
                            try {
                                const userProfile = await User.findOne({ userId: interaction.user.id });
                                const activeNotebook = userProfile?.activeNotebook ? await Notebook.findById(userProfile.activeNotebook) : null;

                                if (activeNotebook && activeNotebook.files.length > 0) {
                                    // Proses Embed Query
                                    const embedResult = await ai.models.embedContent({
                                        model: 'gemini-embedding-001',
                                        contents: query
                                    });
                                    
                                    const vector = embedResult.embeddings[0].values;
                                    const hashes = activeNotebook.files.map(f => f.fileHash);
                                    const hashFilter = `fileHash in [${hashes.map(h => `"${h}"`).join(',')}]`;

                                    // Proses Search Milvus
                                    const searchRes = await milvusClient.search({
                                        collection_name: "notebook_amamiya",
                                        vector: vector,
                                        filter: hashFilter,
                                        output_fields: ["text_content", "page_number", "image_url"],
                                        limit: 2
                                    });

                                    if (searchRes.results.length > 0) {
                                        hasilPencarian = searchRes.results.map(r => `Halaman ${r.page_number}: ${r.text_content}`).join("\n\n");
                                        
                                        // Cek gambar
                                        for (const r of searchRes.results) {
                                            if (r.image_url && fs.existsSync(r.image_url)) {
                                                activeImages.push(fs.readFileSync(r.image_url).toString('base64'));
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error("Milvus Error:", e);
                            }

                            // Kirim Hasil Milvus Kembali ke Gemini
                            console.log("➡️ Mengirim hasil Milvus ke Gemini...");
                            session.sendClientContent({
                                toolResponse: {
                                    functionResponses: [{
                                        id: call.id,
                                        name: call.name,
                                        response: { result: hasilPencarian }
                                    }]
                                }
                            });
                        }
                    }

                    // C. DETEKSI GILIRAN BICARA SELESAI (TURN COMPLETE)
                    if (message.serverContent?.turnComplete) {
                        if (currentAudioChunks.length > 0) {
                            console.log("🔊 Mengirim audio respons utuh ke VTuber UI");
                            const fullPcmBuffer = Buffer.concat(currentAudioChunks);
                            const fullText = currentTextChunks.join(""); // Gabungkan teks subtitle
                            
                            // Live API default output PCM adalah 24kHz
                            const wavHeader = getWavHeader(fullPcmBuffer.length, 24000);
                            const wavBuffer = Buffer.concat([wavHeader, fullPcmBuffer]);
                            
                            interaction.client.io.emit('ai_speak', {
                                audioData: wavBuffer.toString('base64'),
                                teks: fullText.trim() !== "" ? fullText : undefined, // Kirim teks ke main.js
                                emosi: "happy", 
                                gambarBase64: activeImages.length > 0 ? activeImages[0] : null
                            });

                            // Reset penampung untuk percakapan berikutnya
                            currentAudioChunks = [];
                            currentTextChunks = [];
                            activeImages = [];
                        }
                    }
                }
            })(); // Eksekusi fungsi loop asinkron secara langsung
        } catch (error) {
            console.error("Gagal terhubung ke Gemini Live:", error);
            return;
        }

        // 4. MENDENGARKAN SUARA DARI DISCORD SECARA STREAMING INSTAN
        receiver.speaking.on('start', (userId) => {
            if (userId !== interaction.user.id) return;
            console.log(`🎤 ${interaction.user.username} mulai bicara (Streaming ke Gemini...)`);

            // Tidak pakai EndBehaviorType.AfterSilence agar audio langsung mengalir real-time
            const audioStream = receiver.subscribe(userId);
            const decoder = new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 320 }); // Live API optimal di 16kHz
            const pcmStream = audioStream.pipe(decoder);

            pcmStream.on('data', chunk => {
                if (session) {
                    // Lempar potongan suara instan detik itu juga ke Gemini
                    session.sendClientContent({
                        realtimeInput: {
                            mediaChunks: [{
                                mimeType: "audio/pcm;rate=16000",
                                data: chunk.toString("base64")
                            }]
                        }
                    });
                }
            });

            pcmStream.on('end', () => {
                console.log("🛑 Berhenti bicara. Menunggu eksekusi/respon...");
            });
        });
    }
};