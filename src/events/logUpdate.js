const { Events, EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1455934052073865303'; // Samakan dengan ID Log Delete tadi

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // 1. Validasi
        if (!oldMessage.guild) return;
        if (oldMessage.author?.bot) return; // Abaikan bot (penting! karena embed bot sering update sendiri)
        
        // Abaikan jika kontennya sama (biasanya cuma link preview yang muncul)
        if (oldMessage.content === newMessage.content) return;

        const logChannel = oldMessage.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;

        // 2. Buat Embed Perbandingan
        const embed = new EmbedBuilder()
            .setColor(0x3498DB) // Biru
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
            .setTitle('📝 Pesan Diedit (Revisi)')
            .setDescription(`**Lokasi:** ${newMessage.channel} \n[Klik untuk ke pesan](${newMessage.url})`)
            .addFields(
                { name: '❌ Sebelum', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*[Tidak ada teks]*' },
                { name: '✅ Sesudah', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*[Tidak ada teks]*' }
            )
            .setFooter({ text: 'Sistem Pengawas Akademik' })
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};