const { Events, EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1455934052073865303'; 

module.exports = {
    name: Events.GuildMemberRemove, // Event saat member keluar
    async execute(member) {
        const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0x000000) // Hitam (Berkabung/Hilang)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('👋 Mahasiswa Drop Out / Keluar')
            .setDescription(`<@${member.id}> telah meninggalkan server.`)
            .addFields(
                { name: 'Bergabung sejak', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: 'Sisa Member', value: `${member.guild.memberCount} orang`, inline: true }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};

// Catatan: Untuk "Member Join" kita sudah punya fitur "Welcome Image", 
// jadi tidak perlu log teks lagi biar gak double spam.