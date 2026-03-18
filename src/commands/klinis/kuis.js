const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kuis')
        .setDescription('Latihan soal singkat kedokteran gigi'),
    async execute(interaction) {
        const bankSoal = [
            { 
                tanya: "Gigi manakah yang memiliki Cusp of Carabelli?", 
                jawab: ["molar 1 atas", "m1 rahang atas", "16", "26"], 
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

        const index = Math.floor(Math.random() * bankSoal.length);
        const soal = bankSoal[index];

        const embedSoal = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🧠 Kuis Cepat!')
            .setDescription(soal.tanya)
            .setFooter({ text: 'Jawab dalam waktu 15 detik...' });

        await interaction.reply({ embeds: [embedSoal], fetchReply: true });

        const filter = response => {
            return response.author.id === interaction.user.id;
        };

        try {
            const collected = await interaction.channel.awaitMessages({ 
                filter, 
                max: 1, 
                time: 15000, 
                errors: ['time'] 
            });

            const jawabanUser = collected.first().content.toLowerCase();

            if (soal.jawab.includes(jawabanUser)) {
                await interaction.followUp(`✅ **BENAR!**\n${soal.penjelasan}`);
            } else {
                await interaction.followUp(`❌ **SALAH!**\nJawaban yang benar adalah: **${soal.jawab[0]}**\n\n*${soal.penjelasan}*`);
            }

        } catch (error) {
            await interaction.followUp(`⏰ **Waktu Habis!**\nJawabannya adalah: **${soal.jawab[0]}**`);
        }
    },
};
