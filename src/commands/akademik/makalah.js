const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
// IMPORT MUTLAK: SDK Google Gen AI
const { GoogleGenAI, Type } = require('@google/genai');

// 1. Definisi Skema JSON Mutlak menggunakan Type Enum Google
const makalahSchema = {
    type: Type.OBJECT,
    properties: {
        is_complete: { 
            type: Type.BOOLEAN, 
            description: "Bernilai true HANYA JIKA judul, matkul, kelompok, dosen, dan list anggota telah terisi eksplisit." 
        },
        missing_fields: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "Daftar atribut wajib yang belum diisi (contoh: ['dosen', 'kelompok'])." 
        },
        payload: {
            type: Type.OBJECT,
            properties: {
                judul: { type: Type.STRING },
                matkul: { type: Type.STRING },
                dosen: { type: Type.STRING },
                kelompok: { type: Type.STRING },
                anggota: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            nama: { type: Type.STRING },
                            nim: { type: Type.STRING }
                        }
                    }
                },
                latarBelakang: { type: Type.STRING },
                rumusanMasalah: { type: Type.STRING },
                tujuan: { type: Type.STRING },
                teori: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            judul: { type: Type.STRING },
                            isi: { type: Type.STRING }
                        }
                    }
                },
                kesimpulan: { type: Type.STRING },
                saran: { type: Type.STRING },
                dafpus: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        }
    },
    required: ["is_complete", "missing_fields", "payload"]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('makalah')
        .setDescription('Otomatisasi perakitan makalah via Google Docs dengan kemampuan analitik dokumen (PDF/TXT)')
        .addStringOption(option => 
            option.setName('materi')
                .setDescription('Ketik instruksi spesifik atau judul makalah di sini')
                .setRequired(false))
        .addAttachmentOption(option => 
            option.setName('file')
                .setDescription('Upload file riset atau referensi (.pdf, .txt, .json)')
                .setRequired(false)),

    async execute(interaction) { 
        await interaction.deferReply();

        let accumulatedMateri = interaction.options.getString('materi') || "Buatkan kerangka makalah akademik berdasarkan dokumen terlampir.";
        const attachment = interaction.options.getAttachment('file');

        // 2. Persiapan Payload Multimodal (Wadah untuk File Biner)
        let generativeParts = [];

        if (attachment) {
            try {
                // Unduh file murni sebagai ArrayBuffer
                const fileRes = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                
                // Konversi biner file menjadi string Base64 untuk dikonsumsi AI
                const base64Data = Buffer.from(fileRes.data).toString("base64");
                const mime = attachment.contentType || "application/pdf"; 

                generativeParts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: mime
                    }
                });
            } catch (error) {
                console.error("Kesalahan Unduhan File Multimodal:", error);
                return interaction.editReply("❌ **Kegagalan Sistem:** Tidak dapat mengunduh atau mengekstrak lampiran dari peladen Discord.");
            }
        }

        if (!accumulatedMateri.trim() && generativeParts.length === 0) {
            return interaction.editReply("⚠️ **Parameter Kosong:** Anda harus memasukkan teks instruksi atau mengunggah sebuah dokumen referensi.");
        }

        // 3. Fungsi Helper Evaluasi AI Multimodal
        const evaluateWithGemini = async (textToParse) => {
            const promptText = `Tugasmu adalah membedah dokumen terlampir dan/atau instruksi berikut ke dalam format JSON untuk pembuatan makalah akademik. 
Jika user memberikan dokumen riset, pilih, saring, dan susun materi yang paling relevan untuk mengisi latar belakang, teori, dan kesimpulan.
Jika ada data administratif krusial yang kosong (seperti Nama Dosen, Kelompok, Matkul, Anggota), tulis nama field-nya di missing_fields dan ubah is_complete menjadi false.

[INSTRUKSI / KONTEKS TAMBAHAN DARI USER]:
${textToParse}`;
            
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            
            // Menggabungkan instruksi teks dengan file Base64
            const partsToSend = [{ text: promptText }, ...generativeParts];

            const response = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
                contents: partsToSend,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: makalahSchema,
                    temperature: 0.1 // Temperatur rendah untuk membunuh halusinasi data
                }
            });
            
            return JSON.parse(response.text);
        };

        try {
            // 4. Eksekusi Analisis Awal
            await interaction.editReply("⏳ *Amamiya sedang membaca dan membedah dokumen Anda melalui jaringan saraf...*");
            let geminiData = await evaluateWithGemini(accumulatedMateri);

            // 5. SISTEM LOOPING INTERAKTIF (Interogasi Kekurangan Data)
            while (!geminiData.is_complete) {
                const missing = geminiData.missing_fields.join(", ");
                await interaction.editReply(`⚠️ **Amamiya Membutuhkan Data Tambahan!**\nSistem tidak mendeteksi informasi administratif berikut di dalam dokumen: **${missing}**.\n\n*Silakan ketik balasannya di kanal ini (Waktu Anda 5 menit). Ketik 'batal' untuk membatalkan proses.*`);

                const filter = m => m.author.id === interaction.user.id;
                
                try {
                    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 300000, errors: ['time'] });
                    const replyMsg = collected.first();
                    
                    if (replyMsg.content.toLowerCase() === 'batal') {
                        return interaction.editReply("🚫 **Operasi Dibatalkan Secara Manual.**");
                    }

                    // Injeksi balasan user ke dalam akumulasi instruksi
                    accumulatedMateri += `\n\n[Tambahan Informasi dari User]:\n${replyMsg.content}`;
                    
                    await interaction.editReply("⏳ *Amamiya sedang menggabungkan data administratif dan menyusun ulang kerangka makalah...*");
                    geminiData = await evaluateWithGemini(accumulatedMateri);

                } catch (timeoutError) {
                    return interaction.editReply("⏳ **Waktu Tunggu Habis (Timeout).** Proses otomatisasi makalah dibatalkan secara sepihak oleh sistem.");
                }
            }

            // 6. Tembakan Webhook ke Google Apps Script (GAS)
            await interaction.editReply("✅ **Validasi Sukses!**\nSeluruh parameter makalah terpenuhi. Sistem sedang menginjeksi dokumen ke pangkalan data Google Docs...");

            // MUTLAK: PASTIKAN ANDA MENGGANTI URL INI DENGAN DEPLOYMENT WEBHOOK ANDA SENDIRI
            const scriptUrl = "https://script.google.com/macros/s/AKfycbzbv6gvTcS5pUrl.../exec"; 
            
            const webhookResponse = await axios.post(scriptUrl, geminiData.payload, {
                headers: { "Content-Type": "application/json" }
            });

            if (webhookResponse.data.status === "success") {
                await interaction.followUp(`🎉 **Injeksi Dokumen Selesai!**\nMakalah Anda telah berhasil dicetak ke ruang kerja: ${webhookResponse.data.url}`);
            } else {
                await interaction.followUp(`❌ **Kegagalan Sistem Google:**\n${webhookResponse.data.message || 'Pesan kesalahan tidak diketahui dari Google Apps Script'}`);
            }

        } catch (error) {
            console.error("Kesalahan Fatal Modul Makalah:", error);
            await interaction.followUp("❌ **Fatal Error:** Amamiya gagal memproses dokumen atau terputus dari peladen Google Docs.");
        }
    },
};