const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'jurnal',
    description: 'Cari referensi jurnal ilmiah secara instan',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('Mau cari topik apa? Contoh: `!jurnal periodontitis kronis`');
        }

        const query = args.join(' ');
        const queryEncoded = encodeURIComponent(query);

        // Buat Link Pencarian Otomatis
        const linkScholar = `https://scholar.google.com/scholar?q=${queryEncoded}`;
        const linkPubMed = `https://pubmed.ncbi.nlm.nih.gov/?term=${queryEncoded}`;
        const linkGaruda = `https://garuda.kemdikbud.go.id/documents?q=${queryEncoded}`; // Portal Garuda (Jurnal Indo)

        // Buat Tombol yang bisa diklik
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Google Scholar')
                    .setStyle(ButtonStyle.Link)
                    .setURL(linkScholar),
                new ButtonBuilder()
                    .setLabel('PubMed (Inggris)')
                    .setStyle(ButtonStyle.Link)
                    .setURL(linkPubMed),
                new ButtonBuilder()
                    .setLabel('Portal Garuda (Indo)')
                    .setStyle(ButtonStyle.Link)
                    .setURL(linkGaruda),
            );

        const embed = new EmbedBuilder()
            .setColor(0x00A8FF)
            .setTitle(`📚 Pencarian Jurnal: "${query}"`)
            .setDescription('Klik tombol di bawah untuk langsung membuka hasil pencarian di browser.')
            .setFooter({ text: 'Amamiya KG UNSRI' });

        await message.reply({ embeds: [embed], components: [row] });
    },
};