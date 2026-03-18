const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('icd')
        .setDescription('Cari kode ICD-10 untuk diagnosa gigi')
        .addStringOption(option => 
            option.setName('keyword')
                .setDescription('Kata kunci penyakit / diagnosa')
                .setRequired(true)
        ),
    async execute(interaction) {
        const keyword = interaction.options.getString('keyword').toLowerCase();

        // Database Mini (Bisa ditambahkan nanti)
        const databaseICD = [
            { code: 'K02.1', name: 'Karies Dentin', desc: 'Karies yang sudah mencapai dentin.' },
            { code: 'K04.0', name: 'Pulpitis Reversibel', desc: 'Peradangan pulpa ringan.' },
            { code: 'K04.1', name: 'Nekrosis Pulpa', desc: 'Kematian jaringan pulpa.' },
            { code: 'K05.0', name: 'Gingivitis Akut', desc: 'Peradangan gusi mendadak.' },
            { code: 'K05.1', name: 'Gingivitis Kronis', desc: 'Peradangan gusi jangka panjang.' },
            { code: 'K01.1', name: 'Gigi Impaksi', desc: 'Gigi terhalang erupsi.' },
            { code: 'K00.6', name: 'Persistensi Gigi Sulung', desc: 'Gigi susu belum tanggal saat gigi tetap tumbuh.' },
        ];

        // LOGIKA PENCARIAN (Filter)
        const hasilCari = databaseICD.filter(item => 
            item.name.toLowerCase().includes(keyword) || 
            item.code.toLowerCase().includes(keyword)
        );

        if (hasilCari.length === 0) {
            return interaction.reply(`❌ Tidak ditemukan diagnosa yang mengandung kata "**${keyword}**".`);
        }

        // Susun hasil pencarian ke dalam Embed
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F) // Kuning
            .setTitle(`🔎 Hasil Pencarian ICD-10: "${keyword}"`)
            .setDescription(`Ditemukan ${hasilCari.length} hasil.`);

        // Loop hasil pencarian max 5 saja biar tidak spam
        hasilCari.slice(0, 5).forEach(item => {
            embed.addFields({ name: `${item.code} - ${item.name}`, value: item.desc });
        });

        await interaction.reply({ embeds: [embed] });
    },
};
