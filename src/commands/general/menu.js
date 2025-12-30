const { 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ComponentType 
} = require('discord.js');

module.exports = {
    name: 'menu',
    description: 'Dashboard utama Amamiya (All Features)',
    async execute(message, args) {
        // 1. Definisikan Dropdown Kategori
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('menu_kategori')
            .setPlaceholder('Pilih Kategori Fitur...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('🧠 AI & Riset Skripsi')
                    .setDescription('RAG Milvus, Analisis PDF, & Tanya Gemini')
                    .setValue('cat_ai')
                    .setEmoji('🧠'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🩺 Klinis & Praktek')
                    .setDescription('Kalkulator Dosis, OSCE, & Edukasi Pasien')
                    .setValue('cat_klinis')
                    .setEmoji('🦷'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('📚 Akademik & Tugas')
                    .setDescription('Info Lomba, Jurnal, Jadwal, & Sitasi')
                    .setValue('cat_akademik')
                    .setEmoji('📖'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('🎮 Game & Ekonomi')
                    .setDescription('Gacha, Duel, Daily Gold, & Inventory')
                    .setValue('cat_game')
                    .setEmoji('🎲'),
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // 2. Tampilan Awal (Landing Page)
        const embedAwal = new EmbedBuilder()
            .setColor(0x2B2D31) // Dark Grey
            .setTitle('🦷 Amamiya Dashboard v2.0')
            .setDescription(`Halo **${message.author.username}**! 👋\n\nSaya telah diupdate dengan fitur **Database Vector (Milvus)** dan **Sistem Ekonomi**.\nSilakan pilih kategori di bawah untuk melihat perintah lengkap.`)
            .setThumbnail(message.client.user.displayAvatarURL())
            .addFields(
                { name: '🔥 Fitur Baru', value: '• `!skripsi` (Cari skripsi FKG Unsri)\n• `!duel` (PvP Cerdas Cermat)\n• `!gacha` (Koleksi Alat Dental)' }
            )
            .setFooter({ text: 'Powered by Gemini 2.5 Flash & Milvus Vector DB' });

        // 3. Kirim Menu
        const menuMsg = await message.reply({ 
            embeds: [embedAwal], 
            components: [row] 
        });

        // 4. LOGIKA INTERAKSI (Collector 2 Menit)
        const collector = menuMsg.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 120000 
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ content: '❌ Buka menumu sendiri dengan ketik `!menu`.', ephemeral: true });
            }

            const selection = interaction.values[0];
            let newEmbed = new EmbedBuilder();

            // --- LOGIKA TAMPILAN PER KATEGORI ---
            
            if (selection === 'cat_ai') {
                newEmbed.setColor(0x9B59B6) // Ungu AI
                    .setTitle('🧠 AI & Riset (Advanced)')
                    .setDescription('Fitur kecerdasan buatan dan database skripsi.')
                    .addFields(
                        { name: '`!skripsi [topik]`', value: '🔍 **NEW!** Cari referensi skripsi FKG Unsri (2006-2025) via Milvus.' },
                        { name: '`!tanya [pertanyaan]`', value: '💬 Chat dengan AI (Bisa upload foto rontgen/klinis).' },
                        { name: '`!belajar` + [File PDF]', value: '📂 Analisis materi kuliah dosen & simpan ke ingatan bot.' }
                    );
            } 
            else if (selection === 'cat_klinis') {
                newEmbed.setColor(0xE91E63) // Pink Medis
                    .setTitle('🩺 Asisten Klinis (Koas)')
                    .setDescription('Alat bantu hitung dan simulasi pasien.')
                    .addFields(
                        { name: '`!dosis [obat] [bb]`', value: '💊 Hitung dosis obat anak (Amox/Pct/dll).' },
                        { name: '`!osce [skenario]`', value: '🎭 Simulasi roleplay menghadapi pasien virtual.' },
                        { name: '`!hitung ohis [DI] [CI]`', value: '🪥 Kalkulator kebersihan mulut.' },
                        { name: '`!hitung dmft [D] [M] [F]`', value: '🦷 Kalkulator karies.' }
                    );
            }
            else if (selection === 'cat_akademik') {
                newEmbed.setColor(0x3498DB) // Biru Akademik
                    .setTitle('📚 Akademik & Produktivitas')
                    .setDescription('Bantuan tugas kuliah dan info kampus.')
                    .addFields(
                        { name: '`!info [query]`', value: '🔎 Cari info lomba/beasiswa real-time (Google Search).' },
                        { name: '`!jurnal [topik]`', value: '📄 Cari link jurnal (PubMed/Garuda).' },
                        { name: '`!libgen [judul]`', value: '📖 Cari ebook gratis.' },
                        { name: '`!kutip [style] [judul]`', value: '📝 Buat daftar pustaka otomatis (Vancouver).' },
                        { name: '`!para [teks]`', value: '✍️ Parafrase kalimat anti-plagiasi.' },
                        { name: '`!jadwal lihat`', value: '📅 Cek jadwal kuliah pribadi.' },
                        { name: '`!kuis [topik]`', value: '📝 Generate soal latihan pilihan ganda.' }
                    );
            }
            else if (selection === 'cat_game') {
                newEmbed.setColor(0xF1C40F) // Emas Ekonomi
                    .setTitle('🎮 Gamifikasi & Ekonomi')
                    .setDescription('Kumpulkan Gold, XP, dan Item Langka!')
                    .addFields(
                        { name: '`!daily`', value: '💰 **Absen Harian** (Dapat 500-1000 Gold).' },
                        { name: '`!gacha`', value: '🎁 **Tarik Gacha** (Biaya: 500 Gold). Dapatkan item Legendary!' },
                        { name: '`!gacha tas`', value: '🎒 Cek inventory item kamu.' },
                        { name: '`!duel @lawan`', value: '⚔️ **PvP Cerdas Cermat**. Taruhan XP/Gold.' },
                        { name: '`!tebakgambar`', value: '🖼️ Kuis tebak alat/anatomi (Cepat-tepatan).' },
                        { name: '`!profile`', value: '👤 Cek Level, XP, dan Saldo Gold.' },
                        { name: '`!leaderboard`', value: '🏆 Ranking mahasiswa terrajin.' }
                    );
            }

            await interaction.update({ embeds: [newEmbed], components: [row] });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                selectMenu.setDisabled(true).setPlaceholder('Menu Kadaluarsa (Ketik !menu lagi)')
            );
            menuMsg.edit({ components: [disabledRow] }).catch(() => {});
        });
    },
};