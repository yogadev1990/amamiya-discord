const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const crypto = require('crypto'); // Untuk membuat ID Sesi unik

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panggil_ai')
        .setDescription('Panggil asisten dosen AI (Waguri) ke Web Browser'),

    async execute(interaction) {
        // 1. Buat ID Sesi unik (berguna jika nanti Anda ingin melacak riwayat chat per user)
        const sessionId = crypto.randomBytes(4).toString('hex');
        const userId = interaction.user.id;

        // 2. Tentukan URL Web Anda (Ubah localhost jika sudah di-hosting)
        // Kita selipkan parameter agar web.js nanti tahu siapa yang sedang login
        const webUrl = `https://waguri.revanetic.my.id/?session=${sessionId}&user=${userId}`;

        // 3. Buat Tampilan Embed yang cantik
        const embed = new EmbedBuilder()
            .setColor('#FFB6C1') // Warna pink imut
            .setTitle('🎓 Sesi Dosen Waguri Disiapkan!')
            .setDescription(`Halo <@${userId}>! Discord saat ini tidak mendukung video interaktif untuk bot.\n\nSilakan klik tombol di bawah untuk masuk ke ruang kelas 3D dan berbicara langsung dengan Waguri.`)
            .addFields(
                { name: 'ID Sesi', value: `\`${sessionId}\``, inline: true },
                { name: 'Status Akses', value: '🟢 Siap', inline: true }
            )
            .setFooter({ text: 'Waguri Live AI Assistant' })
            .setTimestamp();

        // 4. Buat Tombol Link menuju Web
        const button = new ButtonBuilder()
            .setLabel('Buka Ruang Kelas Waguri')
            .setURL(webUrl)
            .setStyle(ButtonStyle.Link)
            .setEmoji('🌐');

        const row = new ActionRowBuilder().addComponents(button);

        // 5. Kirim balasan (ephemeral = true agar link hanya bisa dilihat oleh user yang memanggil)
        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true 
        });

        console.log(`[Panggil AI] User ${interaction.user.username} membuat sesi web: ${sessionId}`);
    }
};