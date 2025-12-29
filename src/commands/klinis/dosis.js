const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'dosis',
    description: 'Hitung estimasi dosis obat anak (Amoxicillin/Paracetamol)',
    async execute(message, args) {
        // Cek input user. Format harus: !dosis [berat] [nama_obat]
        if (args.length < 2) {
            return message.reply('⚠️ Format salah. Gunakan: `!dosis [berat_kg] [nama_obat]`\nContoh: `!dosis 20 amoxicillin`');
        }

        const berat = parseFloat(args[0]);
        const obat = args[1].toLowerCase();

        // Validasi berat badan
        if (isNaN(berat) || berat <= 0) {
            return message.reply('⚠️ Berat badan harus angka yang valid (kg).');
        }

        let hasil = '';
        let infoObat = '';
        let warna = 0x00FF00; // Hijau

        // LOGIKA PERHITUNGAN
        if (obat === 'amoxicillin' || obat === 'amox') {
            // Rumus: 20-40 mg/kg/hari dibagi 3 dosis
            const minDosis = (20 * berat) / 3;
            const maxDosis = (40 * berat) / 3;
            infoObat = 'Amoxicillin (Antibiotik)';
            hasil = `Rentang dosis: **${Math.round(minDosis)}mg - ${Math.round(maxDosis)}mg**\nDiambil tiap 8 jam (3x sehari).`;
            warna = 0x3498db; // Biru
        } 
        else if (obat === 'paracetamol' || obat === 'pct') {
            // Rumus: 10-15 mg/kg/dosis
            const minDosis = 10 * berat;
            const maxDosis = 15 * berat;
            infoObat = 'Paracetamol (Analgesik/Antipiretik)';
            hasil = `Dosis sekali minum: **${Math.round(minDosis)}mg - ${Math.round(maxDosis)}mg**\nDapat diulang tiap 4-6 jam (Maks 4-5x sehari).`;
            warna = 0xe74c3c; // Merah
        } 
        else {
            return message.reply(`⚠️ Obat **${obat}** belum ada di database saya. Coba: amoxicillin atau paracetamol.`);
        }

        // BUAT TAMPILAN (EMBED)
        const embed = new EmbedBuilder()
            .setColor(warna)
            .setTitle(`💊 Kalkulator Dosis: ${infoObat}`)
            .addFields(
                { name: 'Berat Badan Pasien', value: `${berat} kg`, inline: true },
                { name: 'Hasil Perhitungan', value: hasil }
            )
            .setFooter({ text: '⚠️ Disclaimer: Hanya alat bantu belajar. Gunakan referensi medis resmi.' });

        await message.channel.send({ embeds: [embed] });
    },
};