const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- KONFIGURASI ---
const MENFESS_CHANNEL_ID = '1455760760964649217';
const LOG_CHANNEL_ID = '1455934052073865303'; // Biar admin tau siapa pelakunya

// Path ke file counter
const counterPath = path.join(__dirname, '../../data/menfess_counter.json');

module.exports = {
    name: 'menfess',
    description: 'Kirim pesan rahasia (Anonim) ke kotak surat kampus',
    async execute(message, args) {
        
        // 1. HAPUS PESAN ASLI (PENTING BIAR ANONIM)
        // Kalau dikirim di server (bukan DM), hapus secepat kilat!
        if (message.guild) {
            try {
                await message.delete();
            } catch (e) {
                console.error("Gagal hapus pesan menfess (Cek permission).");
            }
        }

        // 2. VALIDASI INPUT
        const content = args.join(' ');
        const attachment = message.attachments.first();

        if (!content && !attachment) {
            // Kita reply ephemeral (atau DM) kalau input kosong
            return message.author.send("❌ **Format Salah!**\nKetik: `!menfess [isi curhatan]` atau lampirkan gambar.");
        }

        // 3. UPDATE COUNTER (NOMOR URUT)
        let count = 1;
        try {
            const data = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
            count = data.count + 1;
            // Simpan balik
            fs.writeFileSync(counterPath, JSON.stringify({ count: count }));
        } catch (err) {
            // Kalau file error/hilang, buat baru mulai dari 1
            fs.writeFileSync(counterPath, JSON.stringify({ count: 1 }));
        }

        // 4. CARI CHANNEL TUJUAN
        // Kita cari channel target (harus lewat cache client karena mungkin command via DM)
        const targetChannel = message.client.channels.cache.get(MENFESS_CHANNEL_ID);
        const logChannel = message.client.channels.cache.get(LOG_CHANNEL_ID);

        if (!targetChannel) return message.author.send("❌ Maaf, kotak surat sedang dalam perbaikan (Channel tidak ditemukan).");

        // 5. BUAT EMBED PUBLIC (ANONIM)
        const embedPublic = new EmbedBuilder()
            .setColor(0xFF69B4) // Pink Menfess
            .setTitle(`💌 Menfess #${count}`)
            .setDescription(content || '*[Mengirim Gambar]*')
            .setFooter({ text: 'Identitas pengirim disamarkan oleh Amamiya Security.' })
            .setTimestamp();

        // Kalau ada gambar, pasang
        if (attachment) {
            embedPublic.setImage(attachment.url);
        }

        // 6. KIRIM KE CHANNEL PUBLIK
        await targetChannel.send({ embeds: [embedPublic] });

        // 7. FEEDBACK KE PENGIRIM (VIA DM)
        // Biar dia tau pesannya terkirim tanpa nyepam di server
        try {
            await message.author.send(`✅ **Menfess #${count} Terkirim!**\nCek di <#${MENFESS_CHANNEL_ID}>.`);
        } catch (e) {
            // Kadang user tutup DM, biarin aja.
        }

        // 8. LOG KE CHANNEL ADMIN (RAHASIA)
        if (logChannel) {
            const embedLog = new EmbedBuilder()
                .setColor(0x000000) // Hitam
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setTitle(`🕵️ LOG MENFESS #${count}`)
                .setDescription(`**Pengirim Asli:** <@${message.author.id}>\n**Isi:** ${content}`)
                .setFooter({ text: 'Data ini rahasia, hanya untuk moderasi jika ada pelanggaran.' })
                .setTimestamp();
            
            if (attachment) {
                embedLog.addFields({ name: 'Lampiran', value: attachment.url });
            }

            await logChannel.send({ embeds: [embedLog] });
        }
    },
};