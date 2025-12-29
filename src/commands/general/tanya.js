const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'tanya',
    description: 'Tanya AI (Support Gambar)',
    async execute(message, args) {
        // Cek apakah ada attachment gambar
        const attachment = message.attachments.first();
        const textQuery = args.join(' ');

        // Validasi: Harus ada teks ATAU gambar
        if (!textQuery && !attachment) {
            return message.reply('Mau tanya apa? Ketik pertanyaan atau kirim gambar. Contoh: `!tanya` (sambil upload foto)');
        }

        await message.channel.sendTyping();

        try {
            let imageUrl = null;
            let mimeType = null;

            // Jika ada gambar, ambil URL dan tipe-nya
            if (attachment) {
                const contentType = attachment.contentType; // misal: "image/jpeg"
                if (contentType && contentType.startsWith('image/')) {
                    imageUrl = attachment.url;
                    mimeType = contentType;
                } else {
                    return message.reply('⚠️ File yang dikirim bukan gambar. Mohon kirim format JPG/PNG.');
                }
            }

            // Panggil Helper dengan parameter gambar
            const jawaban = await GeminiAi.run(message.author.id, message.author.username, textQuery || "Jelaskan gambar ini", imageUrl, mimeType);

            // Kirim jawaban (potong jika kepanjangan)
            if (jawaban.length > 2000) {
                const chunks = jawaban.match(/[\s\S]{1,1900}/g) || [];
                for (const chunk of chunks) {
                    await message.channel.send(chunk);
                }
            } else {
                await message.reply(jawaban);
            }
            
        } catch (error) {
            console.error(error);
            await message.reply('Terjadi kesalahan saat menghubungi Amamiya.');
        }
    },
};