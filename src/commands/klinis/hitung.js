const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'hitung',
    description: 'Kalkulator Indeks Klinis (OHI-S, DMF-T)',
    async execute(message, args) {
        const type = args[0]?.toLowerCase();

        if (!type) {
            return message.reply('⚠️ Mau hitung apa? Pilihan:\n1. `!hitung ohis [DI] [CI]` (Kebersihan Mulut)\n2. `!hitung dmft [D] [M] [F]` (Indeks Karies)');
        }

        // --- SUB-COMMAND: OHI-S (Oral Hygiene Index Simplified) ---
        if (type === 'ohis') {
            // Rumus: OHI-S = DI (Debris Index) + CI (Calculus Index)
            // Input user: !hitung ohis 1.5 0.8
            
            if (args.length < 3) return message.reply('⚠️ Format: `!hitung ohis [Nilai DI] [Nilai CI]`\nContoh: `!hitung ohis 1.2 0.5`');

            const di = parseFloat(args[1]);
            const ci = parseFloat(args[2]);

            if (isNaN(di) || isNaN(ci)) return message.reply('⚠️ Masukkan angka yang valid (gunakan titik untuk desimal).');

            const skor = di + ci;
            let kriteria = '';
            let warna = 0x00FF00;

            // Kriteria OHI-S (Green & Vermillion)
            if (skor >= 0 && skor <= 1.2) {
                kriteria = 'BAIK (Good)';
                warna = 0x2ECC71; // Hijau
            } else if (skor >= 1.3 && skor <= 3.0) {
                kriteria = 'SEDANG (Fair)';
                warna = 0xF1C40F; // Kuning
            } else if (skor >= 3.1 && skor <= 6.0) {
                kriteria = 'BURUK (Poor)';
                warna = 0xE74C3C; // Merah
            } else {
                return message.reply('⚠️ Skor tidak valid (Maksimal 6.0). Cek inputmu lagi.');
            }

            const embed = new EmbedBuilder()
                .setColor(warna)
                .setTitle('🪥 Hasil Perhitungan OHI-S')
                .addFields(
                    { name: 'Debris Index (DI)', value: `${di}`, inline: true },
                    { name: 'Calculus Index (CI)', value: `${ci}`, inline: true },
                    { name: 'Skor Akhir', value: `**${skor.toFixed(1)}**`, inline: false },
                    { name: 'Interpretasi', value: `**${kriteria}**`, inline: false }
                );

            return message.channel.send({ embeds: [embed] });
        }

        // --- SUB-COMMAND: DMF-T (Decayed, Missing, Filled Teeth) ---
        if (type === 'dmft') {
            // Input: !hitung dmft 2 1 3 (D=2, M=1, F=3)
            if (args.length < 4) return message.reply('⚠️ Format: `!hitung dmft [D] [M] [F]`\nContoh: `!hitung dmft 3 1 0`');

            const d = parseInt(args[1]);
            const m = parseInt(args[2]);
            const f = parseInt(args[3]);

            if (isNaN(d) || isNaN(m) || isNaN(f)) return message.reply('⚠️ Masukkan angka bulat.');

            const total = d + m + f;
            let kategori = '';
            
            // Kategori WHO (Sangat kasar, untuk referensi umum)
            if (total <= 1.1) kategori = 'Sangat Rendah';
            else if (total <= 2.6) kategori = 'Rendah';
            else if (total <= 4.4) kategori = 'Sedang';
            else if (total <= 6.5) kategori = 'Tinggi';
            else kategori = 'Sangat Tinggi';

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🦷 Hasil Perhitungan DMF-T')
                .setDescription(`Indeks Karies Gigi Permanen`)
                .addFields(
                    { name: 'Decayed (Gigi Berlubang)', value: `${d}`, inline: true },
                    { name: 'Missing (Gigi Hilang)', value: `${m}`, inline: true },
                    { name: 'Filled (Gigi Ditambal)', value: `${f}`, inline: true },
                    { name: 'Skor DMF-T', value: `**${total}**`, inline: false },
                    { name: 'Kategori WHO (Global)', value: `${kategori}`, inline: false }
                );

            return message.channel.send({ embeds: [embed] });
        }
    },
};