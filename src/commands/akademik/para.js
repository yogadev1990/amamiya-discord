const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'para',
    description: 'Tulis ulang kalimat agar lolos plagiasi (Paraphraser)',
    async execute(message, args) {
        if (!args.length) return message.reply('Mana teksnya? Contoh: `!para Karies gigi adalah penyakit infeksi mikrobiologis...`');

        const teksAsli = args.join(' ');

        await message.channel.sendTyping();

        const prompt = `
        Lakukan parafrase (tulis ulang) pada teks berikut agar:
        1. Struktur kalimat berubah tapi makna TETAP SAMA.
        2. Menggunakan kosakata akademis/ilmiah yang baik.
        3. Tujuannya untuk menurunkan skor plagiasi Turnitin.
        4. Bahasa: Indonesia Formal.

        Teks Asli: "${teksAsli}"
        
        Berikan 2 opsi variasi hasil parafrase.
        `;

        try {
            const hasil = await GeminiAi.run(message.author.id, message.author.username, prompt);
            await message.reply(`✍️ **Hasil Parafrase:**\n${hasil}`);
        } catch (error) {
            message.reply('Gagal memproses parafrase.');
        }
    },
};