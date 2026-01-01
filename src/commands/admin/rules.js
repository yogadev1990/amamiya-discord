const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'rules',
    description: 'Post rules server dengan tombol verifikasi',
    async execute(message, args) {
        // Cek Admin
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Hussh, ini menu admin.');
        }

        const embedRules = new EmbedBuilder()
            .setColor(0xFF0000) // Merah Tegas
            .setTitle('📜 TATA TERTIB & VERIFIKASI')
            .setDescription(`
Selamat datang! Server ini adalah wadah untuk Studi Kedokteran Gigi, Riset AI, dan Komunitas Mahasiswa. Demi kenyamanan bersama dan kelancaran server, harap patuhi aturan berikut:

**:one: ETIKA & PERILAKU**
- Saling Menghormati: Dilarang melakukan hate speech, rasisme, atau bullying. Kita di sini calon tenaga medis/intelektual, tolong jaga sikap.
- No Drama: Selesaikan masalah pribadi via DM. Jangan bawa keributan ke public chat.
- Bahasa: Gunakan bahasa Indonesia/Inggris yang baik. Boleh santai/gas, tapi tahu tempat.

**:two: KONTEN MEDIS & KLINIS (Penting!) :tooth:**
- NSFW vs Medis: Foto klinis (darah, operasi, luka) DIPERBOLEHKAN hanya untuk tujuan edukasi.
- Privasi Pasien: DILARANG KERAS menyebarkan identitas pasien (Wajah tanpa sensor, Nama Asli, NIK, Alamat) di channel manapun, termasuk saat menggunakan fitur !scan atau !tanya.

**:three: PENGGUNAAN BOT  :robot:**
- No Spamming: Jangan spam command secara berlebihan dalam waktu singkat, beri jeda 10-30 detik.
- Bug & Exploit: Jika menemukan bug (misal: Gold nambah sendiri, jawaban ngawur), lapor ke @Revanda. Jangan dimanfaatkan (exploit) untuk keuntungan pribadi.
- Fitur Menfess: Gunakan \`!menfess\` dengan bijak. Dilarang mengirim ujaran kebencian, fitnah, atau doxing lewat bot anonim. Admin bisa melacak pengirim jika ada pelanggaran hukum.

**:four: AKADEMIK & INTEGRITAS :books:**
- Anti Plagiarisme: Fitur \`!skripsi\`, \`!para\`, dan \`!riset\` adalah alat bantu brainstorming. Dilarang copy-paste mentah-mentah untuk tugas akhir. Segala bentuk plagiasi di kampus adalah tanggung jawab masing-masing user.
- Sharing Materi: Boleh share PDF/Ebook, tapi pastikan itu legal atau "kalangan sendiri".

**:five: SANKSI :hammer:**
- Pelanggaran Ringan: Teguran (Warn) / Timeout 1 Jam.
- Pelanggaran Sedang: Timeout 24 Jam / Reset XP & Gold Bot.
- Pelanggaran Berat: Kick / Ban Permanen.

Setuju dengan aturan di atas? Klik reaksi :white_check_mark: di bawah ini untuk membuka akses ke seluruh channel.
            `)
            .setThumbnail(message.guild.iconURL())
            .setFooter({ text: 'Amamiya KG UNSRI' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_agree') // ID Unik
                .setLabel('Saya Setuju & Verifikasi')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embedRules], components: [row] });
        await message.delete();
    },
};