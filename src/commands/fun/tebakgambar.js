const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User'); // Import model User buat kasih hadiah XP

// --- BANK SOAL ---
// Kamu bisa tambah link gambar dari Google/Discord/Imgur di sini
const bankSoal = [
    {
        url: 'https://farmaco.com.pk/wp-content/uploads/2023/10/a-11.png',
        jawaban: ['kaca mulut', 'mouth mirror', 'mirror'], // Jawaban yang diterima (bisa banyak variasi)
        clue: 'Alat diagnostik dasar untuk melihat bagian gigi yang tersembunyi.'
    },
    {
        url: 'https://m.media-amazon.com/images/I/51yApQEd3KL.jpg',
        jawaban: ['probe', 'periodontal probe', 'probe perio'],
        clue: 'Alat ukur kedalaman saku gusi, ada garis-garis ukurannya.'
    },
    {
        url: 'https://img.medscapestatic.com/pi/meds/ckb/67/26467tn.jpg',
        jawaban: ['blok mandibula', 'mandibular block', 'suntik blok'],
        clue: 'Teknik anestesi untuk mematikan rasa separuh rahang bawah.'
    },
    {
        url: 'https://www.minthilldentistry.com/wp-content/uploads/panoramic-x-ray-thegem-blog-default.jpg',
        jawaban: ['panoramik', 'panoramic', 'opg', 'foto panoramik'],
        clue: 'Jenis foto rontgen yang melihat seluruh rahang sekaligus.'
    },
    {
        url: 'https://www.cranbournenorthdental.com.au/wp-content/uploads/2017/12/amalgam-fillings-blog.jpg',
        jawaban: ['amalgam', 'tambalan amalgam', 'filling amalgam'],
        clue: 'Bahan tambalan jadul berwarna perak/hitam.'
    }
];

module.exports = {
    name: 'tebakgambar',
    description: 'Game tebak nama alat/diagnosa dari gambar',
    async execute(message, args) {
        // 1. Pilih Soal Acak
        const soal = bankSoal[Math.floor(Math.random() * bankSoal.length)];
        
        const embed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle('🖼️ TEBAK GAMBAR DENTAL')
            .setDescription('Apa nama alat/tindakan/diagnosa pada gambar di bawah ini?\n\n⏱️ **Waktu: 30 Detik!**\n💡 Ketik jawabanmu langsung di chat.')
            .setImage(soal.url)
            .setFooter({ text: 'Jawab dengan cepat & tepat!' });

        await message.reply({ embeds: [embed] });

        // 2. Buat Collector (Penyaring Pesan)
        // Kita tangkap pesan dari siapa saja di channel ini
        const filter = m => !m.author.bot; 
        
        const collector = message.channel.createMessageComponentCollector({ time: 30000 }); // Salah logic, harusnya createMessageCollector
        // KOREKSI: Gunakan createMessageCollector untuk menangkap chat text
        const msgCollector = message.channel.createMessageCollector({ filter, time: 30000 });

        let terjawab = false;

        msgCollector.on('collect', async (m) => {
            const tebakan = m.content.toLowerCase();

            // Cek apakah tebakan ada di dalam list jawaban benar
            if (soal.jawaban.some(j => tebakan.includes(j))) {
                terjawab = true;
                msgCollector.stop(); // Stop game

                // BERI HADIAH XP
                let user = await User.findOne({ userId: m.author.id });
                if (!user) {
                     user = await User.create({ userId: m.author.id, username: m.author.username });
                }
                user.xp += 50; // Hadiah gede
                await user.save();

                // Kirim Pesan Menang
                const winEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71) // Hijau
                    .setTitle('🎉 BENAR SEKALI!')
                    .setDescription(`Selamat **${m.author.username}**! 🥳\nJawabannya adalah: **${soal.jawaban[0].toUpperCase()}**`)
                    .addFields({ name: 'Hadiah', value: '+50 XP' })
                    .setThumbnail(m.author.displayAvatarURL());
                
                await m.reply({ embeds: [winEmbed] });
            }
        });

        msgCollector.on('end', async (collected, reason) => {
            if (!terjawab) {
                const loseEmbed = new EmbedBuilder()
                    .setColor(0xE74C3C) // Merah
                    .setTitle('⌛ WAKTU HABIS!')
                    .setDescription(`Sayang sekali tidak ada yang menjawab benar.\n\nJawabannya adalah: **${soal.jawaban[0].toUpperCase()}**`)
                    .setFooter({ text: `Clue: ${soal.clue}` });
                
                await message.channel.send({ embeds: [loseEmbed] });
            }
        });
    },
};