const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'libgen',
    description: 'Cari buku atau ebook di Library Genesis',
    async execute(message, args) {
        if (!args.length) return message.reply('Mau cari buku apa? Contoh: `!libgen Carranza Periodontology`');

        const query = args.join(' ');
        const queryEncoded = encodeURIComponent(query);

        // Kita buat link pencarian ke beberapa mirror LibGen yang populer
        const link1 = `https://libgen.is/search.php?req=${queryEncoded}`;
        const link2 = `https://libgen.rs/search.php?req=${queryEncoded}`;
        const link3 = `https://libgen.li/index.php?req=${queryEncoded}`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setLabel('Mirror 1 (.is)').setStyle(ButtonStyle.Link).setURL(link1),
                new ButtonBuilder().setLabel('Mirror 2 (.rs)').setStyle(ButtonStyle.Link).setURL(link2),
                new ButtonBuilder().setLabel('Mirror 3 (.li)').setStyle(ButtonStyle.Link).setURL(link3),
            );

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`📖 Pencarian LibGen: "${query}"`)
            .setDescription('Klik tombol di bawah untuk melihat hasil pencarian buku/ebook gratis.')
            .setFooter({ text: 'Gunakan dengan bijak untuk keperluan pendidikan.' });

        await message.reply({ embeds: [embed], components: [row] });
    },
};