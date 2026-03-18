const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('Mengirimkan panel Tata Tertib & tombol verifikasi (Khusus Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        
        const embedRules = new EmbedBuilder()
            .setColor('#E74C3C') // Merah Tegas
            .setTitle('📜 TATA TERTIB & VERIFIKASI KLINIS')
            .setDescription(`Selamat datang! Server ini adalah fasilitas untuk Studi Kedokteran Gigi, Riset AI, dan Komunitas Mahasiswa. Demi kenyamanan dan kelancaran akademik, harap patuhi protokol berikut:

**1️⃣ ETIKA & PERILAKU**
• **Saling Menghormati:** Dilarang melakukan *hate speech*, rasisme, atau *bullying*. Kita adalah calon tenaga medis dan intelektual, jaga etika profesi Anda.
• **No Drama:** Selesaikan masalah personal melalui *Direct Message* (DM). Dilarang memicu keributan di ruang publik.
• **Bahasa:** Gunakan bahasa yang pantas. Boleh santai, tetapi harus tahu tempat dan situasi.

**2️⃣ KONTEN MEDIS & KLINIS 🦷**
• **NSFW/Medis:** Foto klinis (darah, luka operasi, anatomi) **DIPERBOLEHKAN** secara mutlak hanya untuk tujuan edukasi dan konsultasi kasus.
• **Privasi Pasien:** **DILARANG KERAS** menyebarkan identitas pasien (Wajah tanpa sensor, Nama Asli, NIK, Alamat) di kanal mana pun, termasuk saat menggunakan modul \`/ask\` untuk analisis radiograf.

**3️⃣ PENGGUNAAN SISTEM AI 🤖**
• **No Spamming:** Sistem memiliki *cooldown* dan pemantauan limit API. Jangan melakukan *spamming* perintah berturut-turut.
• **Bug & Exploit:** Jika menemukan anomali (misal: celah menggandakan *Gold* atau *XP*), segera laporkan ke **@Revanda**. Dilarang mengeksploitasi kelemahan sistem untuk keuntungan pribadi.
• **Fitur Menfess:** Gunakan perintah \`/menfess\` dengan bijak. Dilarang mengirim ujaran kebencian, fitnah, atau *doxing* melalui modul anonim. Log forensik admin dapat melacak identitas pengirim jika terjadi pelanggaran hukum.

**4️⃣ AKADEMIK & INTEGRITAS 📚**
• **Anti Plagiarisme:** Modul AI Amamiya dirancang sebagai alat bantu *brainstorming* dan ringkasan. **Dilarang** *copy-paste* mentah-mentah untuk Tugas Akhir/Skripsi. Segala bentuk plagiasi adalah tanggung jawab Anda sendiri.
• **Sharing Materi:** Modul \`/perpus\` dan berbagi *file* PDF/Jurnal diperbolehkan selama berstatus "untuk kalangan sendiri" (tidak untuk dikomersialkan).

**5️⃣ PROTOKOL SANKSI ⚖️**
• **Pelanggaran Ringan:** Teguran Peringatan / *Timeout* 1 Jam.
• **Pelanggaran Sedang:** *Timeout* 24 Jam / Penghapusan seluruh *XP* & *Gold* (Pemotongan Aset).
• **Pelanggaran Berat:** Pemblokiran Akses Permanen (*Ban*).

Apakah Anda memahami dan menyetujui seluruh protokol di atas?
**Klik tombol ✅ di bawah ini untuk memverifikasi identitas Anda dan membuka akses penuh ke seluruh fasilitas server.**`)
            .setFooter({ 
                text: 'Sistem Keamanan & Verifikasi Amamiya • Universitas Sriwijaya',
                iconURL: interaction.client.user.displayAvatarURL()
            });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_agree') 
                .setLabel('Saya Setuju & Verifikasi')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );

        try {
            await interaction.channel.send({ embeds: [embedRules], components: [row] });

            await interaction.reply({ content: '✅ Panel Tata Tertib berhasil dipublikasikan di kanal ini.', ephemeral: true });
        } catch (error) {
            console.error("Gagal mengirim panel rules:", error);
            await interaction.reply({ content: '❌ Terjadi kesalahan saat mencoba memublikasikan panel.', ephemeral: true });
        }
    },
};
