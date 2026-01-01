const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'setuprole',
    description: 'Spawn menu pemilihan role angkatan (Admin Only)',
    async execute(message, args) {
        // Cek permission admin biar gak dimainin member
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Kamu bukan admin, minggir dulu.');
        }

        // --- DESAIN EMBED ---
        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('🎓 ID CARD MAHASISWA')
            .setDescription(`Selamat datang rekan Sejawat!\n\nAgar kamu bisa mengakses channel khusus angkatanmu dan mendapatkan notifikasi yang relevan, silakan **Pilih Tahun Masuk (Angkatan)** kamu di bawah ini.\n\n*Klik tombol sesuai angkatanmu. Klik lagi untuk melepas role.*`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2997/2997300.png') // Ikon Toga/Kampus
            .setFooter({ text: 'Amamiya KG UNSRI' });

        // --- TOMBOL ANGKATAN ---
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('role_2023') // ID unik untuk coding
                .setLabel('Angkatan 2023')
                .setEmoji('👨‍⚕️')
                .setStyle(ButtonStyle.Primary), // Warna Biru

            new ButtonBuilder()
                .setCustomId('role_2024')
                .setLabel('Angkatan 2024')
                .setEmoji('🦷')
                .setStyle(ButtonStyle.Success), // Warna Hijau

            new ButtonBuilder()
                .setCustomId('role_2025')
                .setLabel('Angkatan 2025')
                .setEmoji('👶') // Ikon bayi/maba wkwk
                .setStyle(ButtonStyle.Danger) // Warna Merah
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete(); // Hapus pesan command kamu biar bersih
    },
};