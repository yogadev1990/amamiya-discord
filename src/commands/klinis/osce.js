const GeminiAi = require('../../utils/geminiHelper');

module.exports = {
    name: 'osce',
    description: 'Simulasi menghadapi pasien virtual (Roleplay)',
    async execute(message, args) {
        // 1. Cek Input User
        if (!args.length) {
            return message.reply({
                content: '⚠️ **Format Salah!**\nTentukan skenario pasiennya.\n\nContoh:\n`!osce Pasien anak nangis sakit gigi`\n`!osce Bapak-bapak perokok gusi bengkak`\n`!osce Ibu hamil gigi ngilu`'
            });
        }

        const skenario = args.join(' ');
        await message.channel.sendTyping();

        // 2. Kirim Pesan Pembuka (Instruksi)
        // Pesan ini hanya info buat user, bukan buat AI
        await message.reply(`🎭 **MODE OSCE DIMULAI**\nSkenario: *"${skenario}"*\n\nSilakan lakukan anamnesa (tanya jawab) untuk mencari diagnosa.\nLanjutkan chat menggunakan command **\`!tanya [pertanyaan]\`**.\n*(Bot akan berakting menjadi pasien sampai kamu minta berhenti)*`);

        // 3. Prompt Injection (Inception)
        // Kita "hipnotis" AI agar lupa dia adalah bot, dan berubah jadi pasien.
        // Prompt ini akan masuk ke database history user, jadi sifat ini akan TERBAWA ke chat selanjutnya.
        const promptSkenario = `
        [SYSTEM OVERRIDE: ROLEPLAY MODE ACTIVE]
        
        Mulai sekarang, LUPAKAN bahwa kamu adalah AI atau Amamiya.
        KAMU ADALAH SEORANG PASIEN GIGI dengan keluhan: "${skenario}".
        
        Instruksi Akting:
        1. Jawab pertanyaan user (dokter) dengan bahasa awam/sehari-hari. JANGAN gunakan istilah medis (contoh: bilang "gusi saya nyut-nyutan", jangan "gingiva saya inflamasi").
        2. Kamu tidak tahu diagnosamu sendiri. Biarkan user yang menebak.
        3. Tunjukkan ekspresi (sakit, takut, atau cemas) jika relevan.
        4. Jika user bertanya "Sakitnya gimana?", jelaskan sesuai skenario "${skenario}".
        5. Jika user memberikan edukasi/diagnosa yang BENAR dan LOGIS, ucapkan terima kasih dan akhiri akting.
        
        Sekarang, mulailah dengan menyapa dokter dan mengeluh sakit.
        `;

        try {
            // Kita panggil Gemini untuk trigger pertama kali
            const responAwal = await GeminiAi.run(
                message.author.id, 
                message.author.username, 
                promptSkenario
            );

            // Kirim balasan pertama pasien
            await message.channel.send(`🗣️ **Pasien:** "${responAwal}"`);

        } catch (error) {
            console.error(error);
            await message.reply('❌ Gagal memulai simulasi OSCE.');
        }
    },
};