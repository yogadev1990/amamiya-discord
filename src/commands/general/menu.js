const { 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ComponentType 
} = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Dashboard utama Amamiya (Daftar Fitur)',
    async execute(message, args) {
        // 1. Definisikan Dropdown Kategori
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_kategori')
            .setPlaceholder('Pilih Kategori Fitur...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('🤖 AI & Materi Kuliah')
                    .setDescription('Tanya materi, analisis PDF/PPT, dan Vision')
                    .setValue('cat_ai')
                    .setEmoji('🧠'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🩺 Klinis & Praktek')
                    .setDescription('Kalkulator medis, OSCE, dan Diagnosa')
                    .setValue('cat_klinis')
                    .setEmoji('🦷'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('📚 Tools Akademik')
                    .setDescription('Jadwal, Jurnal, Sitasi, & Parafrase')
                    .setValue('cat_akademik')
                    .setEmoji('📖'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('👤 Profil Mahasiswa')
                    .setDescription('Cek Level, XP, dan Leaderboard')
                    .setValue('cat_profil')
                    .setEmoji('🎓'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 2. Tampilan Awal (Landing Page)
        const embedAwal = new EmbedBuilder()
            .setColor(0x2B2D31) // Warna Dark Grey Discord
            .setTitle('🦷 Amamiya Dental Assistant')
            .setDescription(`Halo **${message.author.username}**! 👋\n\nSaya adalah asisten AI yang siap membantu perjalanan koas dan kuliahmu.\n\n**Cara Pakai:**\nKlik menu di bawah untuk melihat daftar perintah sesuai kategori.`)
            .setThumbnail(message.client.user.displayAvatarURL())
            .addFields({ name: '⚡ Powered By', value: 'Gemini 2.5 Flash • MongoDB • Node.js' })
            .setFooter({ text: 'Tips: Upload foto rontgen lalu ketik !tanya untuk analisis otomatis.' });

        // 3. Kirim Menu
        const menuMsg = await message.reply({ 
            embeds: [embedAwal], 
            components: [row] 
        });

        // 4. LOGIKA INTERAKSI (Collector)
        // Menu aktif selama 120 detik (2 menit)
        const collector = menuMsg.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 120000 
        });

        collector.on('collect', async (interaction) => {
            // Security: Hanya pemanggil menu yang boleh klik
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: '❌ Ketik `!menu` sendiri untuk membuka dashboardmu.', ephemeral: true });
            }

            const selection = interaction.values[0];
            let newEmbed = new EmbedBuilder().setColor(0x0099FF);

            // --- LOGIKA KATEGORI ---
            
            if (selection === 'cat_ai') {
                newEmbed.setTitle('🧠 AI & Analisis Materi')
                    .setDescription('Fitur cerdas berbasis Gemini 2.5 Flash.')
                    .addFields(
                        { name: '`!tanya [pertanyaan]`', value: 'Ngobrol bebas. Bisa sambil **Upload Foto/Rontgen**.' },
                        { name: '`!belajar` + [File PDF/PPT]', value: 'Analisis materi kuliah secara detail & menyimpannya ke memori bot.' }
                    );
            } 
            else if (selection === 'cat_klinis') {
                newEmbed.setTitle('🩺 Alat Bantu Klinis (FKG)')
                    .setDescription('Tools untuk mempermudah praktikum dan koas.')
                    .addFields(
                        { name: '`!hitung ohis [DI] [CI]`', value: 'Hitung indeks kebersihan mulut (OHI-S).' },
                        { name: '`!hitung dmft [D] [M] [F]`', value: 'Hitung indeks karies gigi.' },
                        { name: '`!osce [keluhan]`', value: 'Simulasi roleplay menghadapi pasien virtual.' },
                        // { name: '`!dosis [berat] [obat]`', value: 'Hitung dosis obat anak.' } // (Jika nanti ditambahkan)
                    );
            }
            else if (selection === 'cat_akademik') {
                newEmbed.setTitle('📚 Akademik & Tugas')
                    .setDescription('Bantu ngerjain laporan dan manajemen waktu.')
                    .addFields(
                        { name: '`!jadwal lihat`', value: 'Cek jadwal kuliah pribadi.' },
                        { name: '`!jadwal tambah [hari] [jam] [matkul]`', value: 'Simpan jadwal baru.' },
                        { name: '`!jurnal [topik]`', value: 'Cari referensi jurnal (Scholar, PubMed, Garuda).' },
                        { name: '`!libgen [judul]`', value: 'Cari buku/ebook gratis.' },
                        { name: '`!kutip [vancouver] [judul]`', value: 'Buat daftar pustaka otomatis.' },
                        { name: '`!para [teks]`', value: 'Parafrase kalimat agar lolos plagiasi.' }
                    );
            }
            else if (selection === 'cat_profil') {
                newEmbed.setTitle('👤 Mahasiswa Center')
                    .setDescription('Gamifikasi dan status progress.')
                    .addFields(
                        { name: '`!profile`', value: 'Lihat Level, XP, dan status mahasiswa.' },
                        { name: '`!leaderboard`', value: 'Lihat peringkat mahasiswa paling rajin.' }
                    );
            }

            // Update pesan menu dengan embed baru (tanpa mengirim pesan baru)
            await interaction.update({ embeds: [newEmbed], components: [row] });
        });

        // Saat waktu habis (Timeout)
        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                selectMenu.setDisabled(true).setPlaceholder('Menu Kadaluarsa (Ketik !menu lagi)')
            );
            // Coba edit pesan, catch error jika pesan sudah dihapus user
            menuMsg.edit({ components: [disabledRow] }).catch(() => {});
        });
    },
};