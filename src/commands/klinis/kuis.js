const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'kuis',
    description: 'Latihan soal singkat kedokteran gigi',
    async execute(message, args) {
        // 1. Database Soal (Nanti bisa dipisah ke file JSON sendiri kalau sudah banyak)
        const bankSoal = [
            { 
                tanya: "Gigi manakah yang memiliki Cusp of Carabelli?", 
                jawab: ["molar 1 atas", "m1 rahang atas", "16", "26"], // Kunci jawaban (bisa variasi)
                penjelasan: "Cusp of Carabelli adalah tuberkel tambahan yang sering ditemukan pada permukaan palatal Molar 1 Rahang Atas."
            },
            { 
                tanya: "Bakteri utama penyebab karies gigi adalah?", 
                jawab: ["streptococcus mutans", "s. mutans", "s mutans"],
                penjelasan: "Streptococcus mutans memetabolisme sukrosa menjadi asam laktat yang mendemineralisasi enamel."
            },
            { 
                tanya: "Berapa jumlah akar pada Molar 1 Rahang Bawah?", 
                jawab: ["2", "dua"],
                penjelasan: "Molar 1 Rahang Bawah normalnya memiliki 2 akar (Mesial dan Distal)."
            }
        ];

        // 2. Pilih soal secara acak
        const index = Math.floor(Math.random() * bankSoal.length);
        const soal = bankSoal[index];

        // 3. Kirim Soal
        const embedSoal = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🧠 Kuis Cepat!')
            .setDescription(soal.tanya)
            .setFooter({ text: 'Jawab dalam waktu 15 detik...' });

        await message.channel.send({ embeds: [embedSoal] });

        // 4. Siapkan Filter (Hanya terima jawaban dari user yang meminta kuis)
        const filter = response => {
            return response.author.id === message.author.id;
        };

        // 5. Mulai Menunggu Jawaban (Collector)
        try {
            const collected = await message.channel.awaitMessages({ 
                filter, 
                max: 1, // Hanya ambil 1 jawaban pertama
                time: 15000, // Waktu 15 detik (15000 ms)
                errors: ['time'] 
            });

            const jawabanUser = collected.first().content.toLowerCase();

            // 6. Cek Jawaban
            // Kita cek apakah jawaban user ada di dalam array kunci jawaban
            if (soal.jawab.includes(jawabanUser)) {
                await message.channel.send(`✅ **BENAR!**\n${soal.penjelasan}`);
            } else {
                await message.channel.send(`❌ **SALAH!**\nJawaban yang benar adalah: **${soal.jawab[0]}**\n\n*${soal.penjelasan}*`);
            }

        } catch (error) {
            // Kalau waktu habis (tidak ada jawaban)
            await message.channel.send(`⏰ **Waktu Habis!**\nJawabannya adalah: **${soal.jawab[0]}**`);
        }
    },
};