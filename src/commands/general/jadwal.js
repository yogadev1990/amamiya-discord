const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'jadwal',
    description: 'Kelola jadwal kuliah pribadi',
    async execute(message, args) {
        // Ambil data user dari DB
        let user = await User.findOne({ userId: message.author.id });
        if (!user) {
            // Buat user baru jika belum ada (antisipasi error)
            user = await User.create({ userId: message.author.id, username: message.author.username, schedule: [] });
        }

        const subCommand = args[0]?.toLowerCase(); // tambah / lihat / hapus

        // --- FITUR 1: LIHAT JADWAL ---
        if (!subCommand || subCommand === 'lihat' || subCommand === 'cek') {
            const jadwalUser = user.schedule || [];

            if (jadwalUser.length === 0) {
                return message.reply('📅 Jadwal kamu masih kosong.\nCara isi: `!jadwal tambah [hari] [jam] [nama_matkul]`\nContoh: `!jadwal tambah senin 08:00 Blok 9`');
            }

            // Urutkan jadwal (Opsional, logika sederhana grouping)
            // Kita kelompokkan berdasarkan hari biar rapi
            const hariUrut = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle(`📅 Jadwal Kuliah: ${user.username}`)
                .setDescription('Ini jadwal yang kamu simpan:');

            hariUrut.forEach(hari => {
                // Filter jadwal sesuai hari saat ini di loop
                const jadwalHariIni = jadwalUser.filter(j => j.hari.toLowerCase() === hari);
                
                if (jadwalHariIni.length > 0) {
                    // Buat list string: "08:00 - Matkul A"
                    const listMatkul = jadwalHariIni
                        .sort((a, b) => a.jam.localeCompare(b.jam)) // Urutkan jam
                        .map(j => `⏰ **${j.jam}** : ${j.matkul}`)
                        .join('\n');

                    // Kapitalisasi huruf pertama hari (senin -> Senin)
                    const namaHari = hari.charAt(0).toUpperCase() + hari.slice(1);
                    embed.addFields({ name: namaHari, value: listMatkul });
                }
            });

            return message.channel.send({ embeds: [embed] });
        }

        // --- FITUR 2: TAMBAH JADWAL ---
        if (subCommand === 'tambah' || subCommand === 'set') {
            // Format: !jadwal tambah senin 08:00 Nama Matkul
            // args[0]=tambah, args[1]=hari, args[2]=jam, args[3++]=matkul

            if (args.length < 4) {
                return message.reply('⚠️ Format salah!\nGunakan: `!jadwal tambah [hari] [jam] [mata kuliah]`\nContoh: `!jadwal tambah senin 07:30 Praktikum Prostodonisa`');
            }

            const hariInput = args[1].toLowerCase();
            const jamInput = args[2];
            const matkulInput = args.slice(3).join(' '); // Gabungkan sisa kata jadi nama matkul

            // Validasi nama hari sederhana
            const validHari = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            if (!validHari.includes(hariInput)) {
                return message.reply('⚠️ Nama hari tidak valid. Gunakan bahasa Indonesia (senin, selasa, dst).');
            }

            // Masukkan ke array schedule user
            user.schedule.push({
                hari: hariInput,
                jam: jamInput,
                matkul: matkulInput
            });

            await user.save(); // Simpan ke MongoDB

            return message.reply(`✅ Berhasil menyimpan jadwal: **${matkulInput}** pada **${hariInput}, ${jamInput}**.`);
        }

        // --- FITUR 3: HAPUS SEMUA (RESET) ---
        if (subCommand === 'reset') {
            user.schedule = [];
            await user.save();
            return message.reply('🗑️ Semua jadwal kamu telah dihapus.');
        }
    },
};