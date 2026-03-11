const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, EndBehaviorType } = require('@discordjs/voice');
const prism = require('prism-media');
const { GoogleGenAI } = require('@google/genai');
const { MilvusClient } = require("@zilliz/milvus2-sdk-node");

// DATABASE
const User = require('../../models/User');
const Notebook = require('../../models/Notebook');

// INIT CLIENT
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const milvusClient = new MilvusClient({
    address: `${process.env.MILVUS_HOST}:${process.env.MILVUS_PORT}`,
    ssl: false
});

// GLOBAL FLAG
let isProcessing = false;


// ===============================
// WAV HEADER GENERATOR
// ===============================

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


// ===============================
// AUDIO ANALYZER
// ===============================

function analyzeAudio(pcmBuffer) {

    let sum = 0;

    for (let i = 0; i < pcmBuffer.length; i += 2) {

        const sample = pcmBuffer.readInt16LE(i);
        sum += sample * sample;

    }

    const rms = Math.sqrt(sum / (pcmBuffer.length / 2));
    const duration = pcmBuffer.length / 2 / 48000;

    return {
        rms,
        duration
    };
}


// ===============================
// COMMAND
// ===============================

module.exports = {

    data: new SlashCommandBuilder()
        .setName('panggil_ai')
        .setDescription('Panggil asisten VTuber AI ke Voice Channel'),

    async execute(interaction) {

        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ Masuk ke Voice Channel dulu!',
                ephemeral: true
            });
        }

        await interaction.reply('🎙️ Amamiya siap mendengar...');

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        const receiver = connection.receiver;

        receiver.speaking.on('start', (userId) => {

            if (userId !== interaction.user.id) return;

            console.log(`🎤 ${interaction.user.username} mulai bicara`);

            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 2000
                }
            });

            const decoder = new prism.opus.Decoder({
                rate: 48000,
                channels: 1,
                frameSize: 960
            });

            const pcmStream = audioStream.pipe(decoder);

            let audioBuffer = [];

            pcmStream.on('data', chunk => {
                audioBuffer.push(chunk);
            });


            pcmStream.on('end', async () => {

                if (audioBuffer.length === 0) return;

                if (isProcessing) {
                    console.log("⏳ AI masih memproses request sebelumnya");
                    return;
                }

                const finalPcmBuffer = Buffer.concat(audioBuffer);

                const analysis = analyzeAudio(finalPcmBuffer);

                console.log(`Durasi: ${analysis.duration.toFixed(2)}s | RMS: ${analysis.rms}`);

                // ===============================
                // FILTER AUDIO
                // ===============================

                if (analysis.duration < 2) {

                    console.log("⏱️ Diabaikan: suara terlalu pendek");
                    return;

                }

                if (analysis.rms < 500) {

                    console.log("🔇 Diabaikan: suara terlalu pelan");
                    return;

                }

                isProcessing = true;

                const wavHeader = getWavHeader(finalPcmBuffer.length);
                const wavBuffer = Buffer.concat([wavHeader, finalPcmBuffer]);
                const base64Audio = wavBuffer.toString('base64');

                interaction.client.io.emit('ai_speak', {
                    teks: "*[Sedang mencerna...]*",
                    emosi: "neutral"
                });

                try {

                    let konteksGabungan = "";
                    let pertanyaanUser = "";

                    // ===============================
                    // STT
                    // ===============================

                    console.log("🧠 STT memproses audio...");

                    const sttResponse = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: [{
                            role: 'user',
                            parts: [
                                { text: 'Transkrip audio ini menjadi teks.' },
                                { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
                            ]
                        }]
                    });

                    pertanyaanUser = sttResponse.text.trim();

                    console.log("📜 Transkrip:", pertanyaanUser);


                    // ===============================
                    // WAKE WORD (OPSIONAL)
                    // ===============================

                    if (!pertanyaanUser.toLowerCase().includes("amamiya")) {

                        console.log("🔕 Tidak ada wake word");
                        isProcessing = false;
                        return;

                    }


                    // ===============================
                    // LOAD NOTEBOOK
                    // ===============================

                    const userProfile = await User.findOne({
                        userId: interaction.user.id
                    });

                    const activeNotebook = userProfile?.activeNotebook
                        ? await Notebook.findById(userProfile.activeNotebook)
                        : null;

                    if (activeNotebook && activeNotebook.files.length > 0) {

                        console.log("📚 Mencari referensi di Milvus");

                        const hashes = activeNotebook.files.map(f => f.fileHash);

                        const embedResult = await ai.models.embedContent({
                            model: 'gemini-embedding-001',
                            contents: pertanyaanUser
                        });

                        const vector = embedResult.embeddings[0].values;

                        const hashFilter = `fileHash in [${hashes.map(h => `"${h}"`).join(',')}]`;

                        const searchRes = await milvusClient.search({
                            collection_name: "notebook_amamiya",
                            vector: vector,
                            filter: hashFilter,
                            output_fields: ["text_content", "page_number"],
                            limit: 3
                        });

                        if (searchRes.results.length > 0) {

                            searchRes.results.forEach(r => {

                                konteksGabungan += `[Hal ${r.page_number}]
${r.text_content}

`;

                            });

                        }

                    }


                    // ===============================
                    // LLM REASONING
                    // ===============================

                    console.log("🧠 Gemini reasoning...");

                    let prompt = `
Jawab sebagai VTuber asisten medis yang cerdas dan imut.
Jawaban maksimal 2 kalimat.

Balas JSON:

{
"teks": "...",
"emosi": "happy/sad/angry/neutral/surprised",
"gaya_bicara": "deskripsi gaya bicara"
}
`;

                    if (konteksGabungan !== "") {

                        prompt = `
Referensi medis:

${konteksGabungan}

Gunakan referensi tersebut untuk menjawab.

${prompt}
`;

                    }

                    const responseLLM = await ai.models.generateContent({

                        model: 'gemini-2.5-flash',

                        contents: [{
                            role: "user",
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: "audio/wav", data: base64Audio } }
                            ]
                        }],

                        config: { responseMimeType: "application/json" }

                    });

                    const hasil = JSON.parse(responseLLM.text);

                    console.log("🤖 Jawaban:", hasil.teks);


                    // ===============================
                    // TTS
                    // ===============================

                    console.log("🔊 Rendering TTS...");

                    const responseTTS = await ai.models.generateContent({

                        model: 'gemini-2.5-flash-preview-tts',

                        contents: `
Style: ${hasil.gaya_bicara}

${hasil.teks}
`,

                        config: {

                            responseModalities: ["AUDIO"],

                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: 'Puck'
                                    }
                                }
                            }

                        }

                    });

                    const audioData =
                        responseTTS.candidates[0]
                        .content.parts[0]
                        .inlineData.data;

                    interaction.client.io.emit('ai_speak', {

                        teks: hasil.teks,
                        emosi: hasil.emosi,
                        audioData: audioData

                    });

                } catch (error) {

                    console.error("❌ ERROR:", error);

                    interaction.client.io.emit('ai_speak', {
                        teks: "*[Sistemku sedang bermasalah]*",
                        emosi: "sad"
                    });

                }

                isProcessing = false;

            });

        });

    }

};