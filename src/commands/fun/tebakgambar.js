const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User'); // Import model User buat kasih hadiah XP

// --- BANK SOAL ---
// Kamu bisa tambah link gambar dari Google/Discord/Imgur di sini
const bankSoal = [
    // --- INSTRUMEN / ALAT ---
    {
        url: 'https://farmaco.com.pk/wp-content/uploads/2023/10/a-11.png',
        jawaban: ['kaca mulut', 'mouth mirror', 'mirror'],
        clue: 'Alat diagnostik dasar untuk melihat bagian gigi yang tersembunyi.'
    },
    {
        url: 'https://m.media-amazon.com/images/I/51yApQEd3KL.jpg',
        jawaban: ['probe', 'periodontal probe', 'probe perio'],
        clue: 'Alat ukur kedalaman saku gusi, ada garis-garis ukurannya.'
    },
    {
        url: 'https://megmedius.com/wp-content/uploads/2021/12/httpsmegmedius.comproductexplorer-dental-probe.jpg',
        jawaban: ['sonde', 'explorer', 'half moon', 'sonde half moon', 'dental explorer'],
        clue: 'Alat ujung runcing (biasanya setengah lingkaran) untuk mencari karies/lubang.'
    },
    {
        url: 'https://th.bing.com/th/id/OIP.UuYiQyFSPSfzqgXL88QzLQHaHa?w=200&h=200&c=10&o=6&dpr=1.5&pid=genserp&rm=2',
        jawaban: ['tang', 'tang cabut', 'forceps', 'extraction forceps'],
        clue: 'Alat logam seperti penjepit untuk mencabut gigi.'
    },
    {
        url: 'https://th.bing.com/th/id/OIP.wY9MSkGdZp6cqvyfVNl86gAAAA?w=200&h=200&c=10&o=6&pid=genserp&rm=2',
        jawaban: ['ekskavator', 'excavator', 'spoon excavator'],
        clue: 'Alat berbentuk sendok kecil untuk mengerok jaringan karies lunak.'
    },

    // --- PENYAKIT / KELAINAN (PATOLOGI) ---
    {
        url: 'https://th.bing.com/th/id/OIP.yh3VQJ-7WqD5kZs_DB4MYAHaDr?w=200&h=200&c=10&o=6&dpr=1.5&pid=genserp&rm=2',
        jawaban: ['karang gigi', 'calculus', 'tartar', 'kalkulus'],
        clue: 'Plak yang mengeras (kalsifikasi), biasanya berwarna kuning/coklat di leher gigi.'
    },
    {
        url: 'https://tse3.mm.bing.net/th/id/OIP.7kgbwV9m1yFoLgmqx8PW6wHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
        jawaban: ['geographic tongue', 'lidah peta', 'benign migratory glossitis'],
        clue: 'Kondisi lidah dengan bercak merah dikelilingi batas putih yang berpindah-pindah mirip peta.'
    },
    {
        url: 'https://tse2.mm.bing.net/th/id/OIP.LOcQFSAlwE_dCftLpAiGZAHaFe?rs=1&pid=ImgDetMain&o=7&rm=3',
        jawaban: ['gingivitis', 'radang gusi'],
        clue: 'Kondisi gusi merah, bengkak, dan mudah berdarah akibat penumpukan plak.'
    },
    {
        url: 'https://image.slidesharecdn.com/recurrentaphthousstomatitis-160310075933/95/recurrent-aphthous-stomatitis-5-638.jpg?cb=1457596895',
        jawaban: ['sariawan', 'stomatitis aphtosa', 'sar', 'aphthous ulcer'],
        clue: 'Luka kecil di mukosa mulut, warna putih/kuning dengan halo merah, terasa perih.'
    },

    // --- RADIOLOGI & ANOMALI ---
    {
        url: 'https://www.minthilldentistry.com/wp-content/uploads/panoramic-x-ray-thegem-blog-default.jpg',
        jawaban: ['panoramik', 'panoramic', 'opg', 'foto panoramik'],
        clue: 'Jenis foto rontgen yang melihat seluruh rahang (kiri-kanan) sekaligus.'
    },
    {
        url: 'https://res.cloudinary.com/dk0z4ums3/image/upload/v1703300268/attached_image/penyakit/kesehatan-gigi-dan-mulut/impaksi-gigi-0-alomedika.jpg',
        jawaban: ['impaksi', 'impacted', 'gigi impaksi', 'gigi bungsu miring'],
        clue: 'Kondisi gigi gagal tumbuh sempurna karena terhalang gigi lain (lihat rontgen).'
    },
    {
        url: 'https://tse2.mm.bing.net/th/id/OIP.hvHrEiP038bSOeyUzR8-qgHaEH?rs=1&pid=ImgDetMain&o=7&rm=3',
        jawaban: ['mesiodens', 'supernumerary teeth'],
        clue: 'Gigi berlebih (supernumerary) yang tumbuh tepat di tengah dua gigi seri atas.'
    },
    {
        url: 'https://tse1.mm.bing.net/th/id/OIP.WeajZ7vRn0mo1J8X7NvoxwHaFq?rs=1&pid=ImgDetMain&o=7&rm=3',
        jawaban: ['abses', 'abses periapikal', 'periapical abscess'],
        clue: 'Bayangan radiolusent (hitam) bulat di ujung akar gigi pada foto rontgen, tanda infeksi.'
    },

    // --- BAHAN & PERAWATAN (TREATMENT) ---
    {
        url: 'https://www.cranbournenorthdental.com.au/wp-content/uploads/2017/12/amalgam-fillings-blog.jpg',
        jawaban: ['amalgam', 'tambalan amalgam', 'filling amalgam'],
        clue: 'Bahan tambalan konvensional berwarna perak/hitam.'
    },
    {
        url: 'https://tse3.mm.bing.net/th/id/OIP.fh0zKokxHuqMUTT8j9q0rQHaED?rs=1&pid=ImgDetMain&o=7&rm=3',
        jawaban: ['bridge', 'jembatan gigi', 'dental bridge'],
        clue: 'Gigi tiruan cekat yang mengganti gigi hilang dengan menyangga pada gigi sebelahnya.'
    },
    {
        url: 'https://tse3.mm.bing.net/th/id/OIP.bOOxcB2S_4GgCnj6NylkGwHaE8?rs=1&pid=ImgDetMain&o=7&rm=3',
        jawaban: ['behel', 'kawat gigi', 'braces', 'orthodontic'],
        clue: 'Perawatan ortodonti cekat menggunakan bracket dan kawat untuk merapikan gigi.'
    },
    {
        url: 'https://www.premierdentalco.com/wp-content/uploads/2015/09/k-files2.jpg',
        jawaban: ['file', 'file endo', 'jarum saluran akar', 'k-file'],
        clue: 'Jarum kecil berulir untuk membersihkan saluran akar gigi (perawatan saraf).'
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
            .setFooter({ text: `Clue: ${soal.clue}` });

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