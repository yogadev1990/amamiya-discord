const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuprole')
        .setDescription('Memunculkan panel registrasi angkatan mahasiswa (Khusus Administrator)')
        // Mutlak: Hanya user dengan hak Administrator yang bisa melihat/memakai command ini
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // --- RENDER ANTARMUKA PANEL ---
        const embed = new EmbedBuilder()
            .setColor('#2B2D31') // Warna abu-abu elegan khas Discord
            .setTitle('🎓 IDENTITAS KLINIS & ANGKATAN')
            .setDescription(`Selamat datang, Rekan Sejawat!\n\nAgar Anda dapat mengakses kanal khusus angkatan dan menerima notifikasi akademik yang relevan, silakan **Pilih Tahun Masuk (Angkatan)** Anda pada panel di bawah ini.\n\n*Klik tombol sesuai angkatan Anda. Klik kembali untuk melepaskan role.*`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2997/2997300.png') 
            .setFooter({ 
                text: 'Sistem Registrasi Amamiya • Universitas Sriwijaya',
                iconURL: interaction.client.user.displayAvatarURL()
            });

        // --- RENDER TOMBOL INTERAKTIF ---
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('role_2023') // ID Absolut untuk Event Listener
                .setLabel('Angkatan 2023')
                .setEmoji('👨‍⚕️')
                .setStyle(ButtonStyle.Primary), // Biru

            new ButtonBuilder()
                .setCustomId('role_2024')
                .setLabel('Angkatan 2024')
                .setEmoji('🦷')
                .setStyle(ButtonStyle.Success), // Hijau

            new ButtonBuilder()
                .setCustomId('role_2025')
                .setLabel('Angkatan 2025')
                .setEmoji('👶') // Ikon Maba
                .setStyle(ButtonStyle.Danger)   // Merah
        );

        try {
            // 1. Eksekusi Pengiriman Panel ke Kanal
            await interaction.channel.send({ embeds: [embed], components: [row] });

            // 2. Balasan Rahasia (Ephemeral) agar interaksi selesai dan tidak dianggap error oleh sistem
            await interaction.reply({ content: '✅ Panel Pemilihan Angkatan berhasil dicetak dan dipublikasikan di kanal ini.', ephemeral: true });
        } catch (error) {
            console.error("Kesalahan Eksekusi Panel Role:", error);
            await interaction.reply({ content: '❌ **Sistem Gagal:** Terjadi anomali saat mencoba mencetak panel ke kanal.', ephemeral: true });
        }
    },
};
