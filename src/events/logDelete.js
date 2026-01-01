const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');

// MASUKKAN ID CHANNEL LOG DISINI
const LOG_CHANNEL_ID = '1455934052073865303'; 

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // 1. Validasi Dasar
        if (!message.guild) return; // Abaikan DM
        if (message.author?.bot) return; // Abaikan pesan bot sendiri
        
        // Cek channel log ada atau tidak
        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;

        // 2. Cek apakah pesan Partial (Pesan lama sebelum bot nyala)
        // Kalau partial, kita gak tau isi kontennya, cuma tau ID-nya.
        if (message.partial) {
            const embedPartial = new EmbedBuilder()
                .setColor(0xFFA500) // Orange
                .setTitle('🗑️ Pesan Lama Dihapus')
                .setDescription(`Sebuah pesan lama (tidak ter-cache) dihapus di channel ${message.channel}.`)
                .setFooter({ text: 'Satpam Kampus' })
                .setTimestamp();
            return logChannel.send({ embeds: [embedPartial] });
        }

        // 3. Deteksi Ghost Ping (Ngetag orang terus dihapus)
        const isGhostPing = message.mentions.users.size > 0 || message.mentions.roles.size > 0;
        
        // 4. Siapkan Embed Laporan
        const embed = new EmbedBuilder()
            .setColor(isGhostPing ? 0xFF0000 : 0xE74C3C) // Merah Terang kalau Ghost Ping
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setTitle(isGhostPing ? '👻 GHOST PING TERDETEKSI!' : '🗑️ Pesan Dihapus')
            .addFields(
                { name: 'Pelaku', value: `<@${message.author.id}>`, inline: true },
                { name: 'Lokasi', value: `${message.channel}`, inline: true },
                { name: 'Isi Pesan', value: message.content ? message.content.substring(0, 1024) : '*[Gambar/Stiker saja]*' }
            )
            .setFooter({ text: `ID Pesan: ${message.id}` })
            .setTimestamp();

        // Kalau ada lampiran gambar yang dihapus
        if (message.attachments.size > 0) {
            embed.addFields({ name: 'Lampiran', value: 'User menghapus gambar/file.' });
        }

        logChannel.send({ embeds: [embed] });
    },
};