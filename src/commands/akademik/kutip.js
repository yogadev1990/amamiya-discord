const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'kutip',
    description: 'Buat daftar pustaka otomatis (Style: Vancouver/APA)',
    async execute(message, args) {
        // Cara pakai: !kutip [vancouver/apa] [judul/link/doi]
        // Default ke Vancouver jika tidak disebut
        
        if (!args.length) return message.reply('Contoh: `!kutip vancouver Carranza Clinical Periodontology 13th edition`');

        let style = args[0].toLowerCase();
        let query = "";

        if (['vancouver', 'apa', 'harvard'].includes(style)) {
            query = args.slice(1).join(' ');
        } else {
            style = 'vancouver'; // Default FKG biasanya Vancouver
            query = args.join(' ');
        }

        await message.channel.sendTyping();

        const prompt = `
        Tolong buatkan sitasi/daftar pustaka untuk sumber berikut: "${query}"
        
        Format yang diminta: **${style.toUpperCase()} Style**.
        
        Instruksi:
        1. Cari metadata buku/jurnal tersebut (Penulis, Tahun, Judul, Penerbit/DOI) dari pengetahuanmu.
        2. Berikan output HANYA teks sitasinya saja agar siap dicopy-paste.
        3. Jika sumber tidak jelas, berikan format template umum saja.
        `;

        try {
            const hasil = await GeminiAi.run(message.author.id, message.author.username, prompt);
            await message.reply(`📝 **Sitasi (${style.toUpperCase()}):**\n\`\`\`${hasil}\`\`\``);
        } catch (error) {
            message.reply('Gagal membuat sitasi.');
        }
    },
};