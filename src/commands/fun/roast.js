const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'roast',
    description: 'Minta dospem killer me-review judul/alasan kamu (Sarkas Mode!)',
    async execute(message, args) {
        if (!args.length) return message.reply('Apa yang mau di-roast? Judul skripsi atau keluhanmu? Contoh: `!roast judulku pengaruh air wudhu terhadap karies`');

        const inputUser = args.join(' ');
        await message.channel.sendTyping();

        const prompt = `
        Mode: DOSEN PEMBIMBING KILLER & SARKAS.
        User (Mahasiswa Abadi) memberikan input: "${inputUser}"
        
        Tugasmu:
        1. Kritis input tersebut dengan pedas, lucu, dan sarkas.
        2. Gunakan gaya bahasa dosen yang meremehkan tapi sebenarnya peduli (sedikit).
        3. Singgung soal "Kapan wisuda?", "Revisi terus", atau "Judul pasaran".
        4. Jangan terlalu kasar (hate speech), tapi cukup bikin "kena mental".
        5. Bahasa gaul/sehari-hari campur formal.
        
        Contoh tone: "Judul macam apa ini? Anak SD juga bisa bikin. Kapan mau lulus kalau pola pikirmu masih begini?"
        `;

        try {
            const hasil = await GeminiAi.run(message.author.id, message.author.username, prompt);
            await message.reply(`🔥 **Dospem Killer:**\n"${hasil}"`);
        } catch (error) {
            message.reply('Dospemnya lagi cuti (Error).');
        }
    },
};