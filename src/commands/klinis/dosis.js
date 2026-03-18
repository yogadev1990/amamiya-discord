const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dosis')
        .setDescription('Hitung estimasi dosis obat anak (Amoxicillin/Paracetamol)')
        .addNumberOption(option => 
            option.setName('berat')
                .setDescription('Berat badan anak (kg)')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('obat')
                .setDescription('Nama Obat')
                .setRequired(true)
                .addChoices(
                    { name: 'Amoxicillin', value: 'amoxicillin' },
                    { name: 'Paracetamol', value: 'paracetamol' }
                )
        ),
    async execute(interaction) {
        const berat = interaction.options.getNumber('berat');
        const obat = interaction.options.getString('obat');

        if (berat <= 0) {
            return interaction.reply({ content: '⚠️ Berat badan harus lebih dari 0 kg.', ephemeral: true });
        }

        let hasil = '';
        let infoObat = '';
        let warna = 0x00FF00;

        if (obat === 'amoxicillin') {
            const minDosis = (20 * berat) / 3;
            const maxDosis = (40 * berat) / 3;
            infoObat = 'Amoxicillin (Antibiotik)';
            hasil = `Rentang dosis: **${Math.round(minDosis)}mg - ${Math.round(maxDosis)}mg**\nDiambil tiap 8 jam (3x sehari).`;
            warna = 0x3498db; 
        } 
        else if (obat === 'paracetamol') {
            const minDosis = 10 * berat;
            const maxDosis = 15 * berat;
            infoObat = 'Paracetamol (Analgesik/Antipiretik)';
            hasil = `Dosis sekali minum: **${Math.round(minDosis)}mg - ${Math.round(maxDosis)}mg**\nDapat diulang tiap 4-6 jam (Maks 4-5x sehari).`;
            warna = 0xe74c3c; 
        } 

        const embed = new EmbedBuilder()
            .setColor(warna)
            .setTitle(`💊 Kalkulator Dosis: ${infoObat}`)
            .addFields(
                { name: 'Berat Badan Pasien', value: `${berat} kg`, inline: true },
                { name: 'Hasil Perhitungan', value: hasil }
            )
            .setFooter({ text: '⚠️ Disclaimer: Hanya alat bantu belajar. Gunakan referensi medis resmi.' });

        await interaction.reply({ embeds: [embed] });
    },
};
