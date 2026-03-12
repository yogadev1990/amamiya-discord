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
        let currentTextChunks = [];  // Penampung transkrip teks
        let activeImages = []; // Penampung gambar referensi

        try {
            session = await ai.live.connect({
                // PERBAIKAN 1: Menggunakan model persis seperti di dokumentasi
                model: 'models/gemini-2.5-flash-native-audio-preview-12-2025', 
                config: {
                    systemInstruction: {
                        parts: [{ text: "Kamu adalah Amamiya, VTuber asisten medis di Fakultas Kedokteran Gigi. Jawab dengan cepat, cerdas, dan imut." }]
                    },
                    responseModalities: [Modality.AUDIO],
                    // PERBAIKAN 2: Mengaktifkan transkripsi teks sesuai dokumentasi agar web tetap dapat teks
                    outputAudioTranscription: {}, 
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Despina' } }
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log("✅ WebSocket Gemini Live Terhubung!");
                    },
                    onmessage: async (message) => {
                        const content = message.serverContent;
                        if (!content) return;

                        // A. TANGKAP AUDIO
                        if (content.modelTurn?.parts) {
                            for (const part of content.modelTurn.parts) {
                                if (part.inlineData && part.inlineData.data) {
                                    currentAudioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
                                }
                            }
                        }

                        // B. TANGKAP TRANSKRIP TEKS (Sesuai Dokumentasi)
                        if (content.outputTranscription) {
                            currentTextChunks.push(content.outputTranscription.text);
                        }

                        // C. DETEKSI GILIRAN BICARA SELESAI
                        if (content.turnComplete) {
                            if (currentAudioChunks.length > 0) {
                                console.log("🔊 Mengirim audio respons utuh ke VTuber UI");
                                const fullPcmBuffer = Buffer.concat(currentAudioChunks);
                                const fullText = currentTextChunks.join(" ");
                                
                                const wavHeader = getWavHeader(fullPcmBuffer.length, 24000);
                                const wavBuffer = Buffer.concat([wavHeader, fullPcmBuffer]);
                                
                                interaction.client.io.emit('ai_speak', {
                                    audioData: wavBuffer.toString('base64'),
                                    teks: fullText.trim() !== "" ? fullText.trim() : "*[Bicara...]*",
                                    emosi: "happy", 
                                    gambarBase64: activeImages.length > 0 ? activeImages[0] : null
                                });

                                currentAudioChunks = [];
                                currentTextChunks = [];
                                activeImages = [];
                            }
                        }
                    },
                    onerror: (e) => console.error("❌ Gemini Live Error:", e),
                    onclose: (e) => console.log("🔌 Gemini Live Ditutup:", e?.reason || "")
                }
            });
        } catch (error) {
            console.error("Gagal terhubung ke Gemini Live:", error);
            return;
        }

        // 4. MENDENGARKAN SUARA DARI DISCORD SECARA STREAMING INSTAN
        receiver.speaking.on('start', (userId) => {
            if (userId !== interaction.user.id) return;
            console.log(`🎤 ${interaction.user.username} mulai bicara (Streaming ke Gemini...)`);

            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000 // Tunggu 1 detik keheningan
                }
            });
            
            const decoder = new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 320 }); 
            const pcmStream = audioStream.pipe(decoder);

            pcmStream.on('data', chunk => {
                // PERBAIKAN 3: Format payload input persis sesuai panduan resmi
                if (session && chunk.length > 0) {
                    session.sendRealtimeInput({
                        audio: {
                            data: chunk.toString("base64"),
                            mimeType: "audio/pcm;rate=16000"
                        }
                    });
                }
            });

            pcmStream.on('end', () => {
                console.log("🛑 Berhenti bicara. Mengirim sinyal audioStreamEnd...");
                // PERBAIKAN 4: Mengirim sinyal end stream resmi dari dokumentasi
                if (session) {
                    session.sendRealtimeInput({ audioStreamEnd: true });
                }
            });
        });
    }
};