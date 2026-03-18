const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hitung')
        .setDescription('Kalkulator Indeks Klinis (OHI-S, DMF-T)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ohis')
                .setDescription('Hitung Kebersihan Mulut (OHI-S)')
                .addNumberOption(option => 
                    option.setName('di')
                        .setDescription('Nilai Debris Index (DI)')
                        .setRequired(true)
                )
                .addNumberOption(option => 
                    option.setName('ci')
                        .setDescription('Nilai Calculus Index (CI)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dmft')
                .setDescription('Hitung Indeks Karies (DMF-T)')
                .addIntegerOption(option => 
                    option.setName('d')
                        .setDescription('Decayed (Gigi Berlubang)')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('m')
                        .setDescription('Missing (Gigi Hilang)')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('f')
                        .setDescription('Filled (Gigi Ditambal)')
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        const type = interaction.options.getSubcommand();

        if (type === 'ohis') {
            const di = interaction.options.getNumber('di');
            const ci = interaction.options.getNumber('ci');

            const skor = di + ci;
            let kriteria = '';
            let warna = 0x00FF00;

            if (skor >= 0 && skor <= 1.2) {
                kriteria = 'BAIK (Good)';
                warna = 0x2ECC71; 
            } else if (skor >= 1.3 && skor <= 3.0) {
                kriteria = 'SEDANG (Fair)';
                warna = 0xF1C40F; 
            } else if (skor >= 3.1 && skor <= 6.0) {
                kriteria = 'BURUK (Poor)';
                warna = 0xE74C3C; 
            } else {
                return interaction.reply({ content: '⚠️ Skor tidak valid (Maksimal 6.0). Cek inputmu lagi.', ephemeral: true });
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

            return interaction.reply({ embeds: [embed] });
        }

        if (type === 'dmft') {
            const d = interaction.options.getInteger('d');
            const m = interaction.options.getInteger('m');
            const f = interaction.options.getInteger('f');

            const total = d + m + f;
            let kategori = '';
            
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

            return interaction.reply({ embeds: [embed] });
        }
    },
};
