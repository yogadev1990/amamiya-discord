const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- KONFIGURASI MUTLAK ---
const MENFESS_CHANNEL_ID = '1455760760964649217';
const LOG_CHANNEL_ID = '1455934052073865303'; 

const dataDir = path.join(__dirname, '../../data');
const counterPath = path.join(dataDir, 'menfess_counter.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menfess')
        .setDescription('Kirim pesan rahasia (Anonim) ke kotak surat kampus')
        .addStringOption(option =>
            option.setName('pesan')
                .setDescription('Isi curhatan, pertanyaan, atau pesan rahasia Anda')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName('gambar')
                .setDescription('Lampirkan gambar jika diperlukan')
                .setRequired(false)
        ),

    async execute(interaction) {
        // 1. VALIDASI INPUT & KUNCI SESI (EPHEMERAL)
        const content = interaction.options.getString('pesan');
        const attachment = interaction.options.getAttachment('gambar');

        if (!content && !attachment) {
            return interaction.reply({
                content: "❌ **Format Ditolak:** Anda harus mengisi pesan teks atau melampirkan gambar.",
                ephemeral: true
            });
        }

        // Kunci balasan sebagai Ephemeral (Hanya pengirim yang bisa melihat status bot sedang berpikir)
        await interaction.deferReply({ ephemeral: true });

        // 2. SISTEM COUNTER (NOMOR URUT)
        let count = 1;
        try {
            // Memastikan folder data ada sebelum membaca/menulis
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

            if (fs.existsSync(counterPath)) {
                const data = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
                count = data.count + 1;
            }
            fs.writeFileSync(counterPath, JSON.stringify({ count: count }));
        } catch (err) {
            console.error("Kesalahan membaca file counter Menfess:", err);
            // Tetap lanjut meskipun gagal baca file, reset ke 1
            fs.writeFileSync(counterPath, JSON.stringify({ count: 1 }));
        }

        // 3. TARGET KANAL
        const targetChannel = interaction.client.channels.cache.get(MENFESS_CHANNEL_ID);
        const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);

        if (!targetChannel) {
            return interaction.editReply("❌ **Koneksi Terputus:** Kotak surat (Channel) sedang tidak dapat diakses.");
        }

        try {
            // 4. MERENDER ANTARMUKA PUBLIK (ANONIM MUTLAK)
            const embedPublic = new EmbedBuilder()
                .setColor('#FF69B4') // Pink Menfess
                .setTitle(`💌 Menfess #${count}`)
                .setDescription(content || '*[Lampiran Gambar Tanpa Teks]*')
                .setFooter({ text: 'Identitas pengirim disamarkan oleh Amamiya Security' })
                .setTimestamp();

            if (attachment) {
                // Validasi tambahan agar tidak error jika file bukan gambar
                if (attachment.contentType?.startsWith('image/')) {
                    embedPublic.setImage(attachment.url);
                } else {
                    embedPublic.addFields({ name: '📁 Lampiran File', value: attachment.url });
                }
            }

            // Eksekusi pengiriman ke publik
            await targetChannel.send({ embeds: [embedPublic] });

            // 5. MERENDER ANTARMUKA LOG ADMINISTRATOR (RAHASIA)
            if (logChannel) {
                const embedLog = new EmbedBuilder()
                    .setColor('#2C3E50') // Warna gelap untuk log
                    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(`🕵️ LOG MENFESS #${count}`)
                    .setDescription(`**Pengirim Asli:** <@${interaction.user.id}>\n**Isi Teks:**\n${content || '*Kosong*'}`)
                    .setFooter({ text: 'Data forensik rahasia. Hanya untuk moderasi.' })
                    .setTimestamp();
                
                if (attachment) {
                    embedLog.setImage(attachment.url);
                }

                await logChannel.send({ embeds: [embedLog] });
            }

            // 6. KONFIRMASI KE PENGIRIM (EPHEMERAL)
            await interaction.editReply(`✅ **Menfess #${count} Terkirim!**\nSilakan cek di kanal <#${MENFESS_CHANNEL_ID}>.`);

        } catch (error) {
            console.error("Kesalahan Pengiriman Menfess:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali saat mengirimkan Menfess Anda.");
        }
    },
};