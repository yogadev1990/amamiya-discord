const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('libgen')
        .setDescription('Cari buku atau ebook di Library Genesis')
        .addStringOption(option => 
            option.setName('kueri')
                .setDescription('Judul buku yang ingin dicari (Contoh: Carranza Periodontology)')
                .setRequired(true)
        ),
    async execute(interaction) {
        const query = interaction.options.getString('kueri');
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

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
