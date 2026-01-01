const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    name: 'menu',
    aliases: ['help', 'cmd', 'fitur', 'bantuan'],
    description: 'Dashboard utama fitur Amamiya',
    async execute(message, args) {
        
        // --- DATABASE FITUR (Sesuai File Tree Kamu) ---
        const commandsData = {
            akademik: {
                title: '📚 Akademik & Skripsi',
                description: 'Tools AI untuk mempermudah hidup mahasiswa.',
                cmds: [
                    { name: '!katalog', desc: '🏛️ Repository Skripsi Digital (Data Lengkap)' },
                    { name: '!skripsi [topik]', desc: '🤖 Cari inspirasi judul skripsi via AI' },
                    { name: '!kerangka [judul]', desc: '📝 Generator Outline Bab 1-3 otomatis' },
                    { name: '!jurnal [topik]', desc: '🔎 Cari referensi jurnal ilmiah' },
                    { name: '!libgen [judul]', desc: '📖 Cari buku/ebook gratis' },
                    { name: '!para [teks]', desc: '✍️ Paraphrase kalimat biar lolos turnitin' },
                    { name: '!kutip [sumber]', desc: '🔖 Buat format sitasi otomatis' },
                    { name: '!belajar [topik]', desc: '🧠 Tanya materi kuliah ke AI' },
                    { name: '!info', desc: 'ℹ️ Informasi umum akademik' },
                ]
            },
            klinis: {
                title: '🩺 Klinis & Praktek',
                description: 'Asisten koass dan praktikum.',
                cmds: [
                    { name: '!icd [diagnosa]', desc: '🏥 Cek kode ICD-10 otomatis' },
                    { name: '!dosis [BB]', desc: '💊 Hitung dosis obat anak' },
                    { name: '!hitung', desc: '🧮 Kalkulator medis umum' },
                    { name: '!osce', desc: '🎭 Simulasi kasus/skenario OSCE' },
                    { name: '!kuis', desc: '📝 Latihan soal-soal kedokteran gigi' },
                ]
            },
            fun: {
                title: '🎮 Hiburan & Game',
                description: 'Lepas penat sejenak, cari Gold & XP!',
                cmds: [
                    { name: '!gacha', desc: '🎰 Gacha item dental (Cost: 100 Gold)' },
                    { name: '!duel @user', desc: '⚔️ Taruhan Gold adu pinter lawan teman' },
                    { name: '!tebakgambar', desc: '🖼️ Game tebak gambar anatomi/alat' },
                    { name: '!khodam', desc: '👻 Cek khodam dental kamu' },
                    { name: '!roast [keluhan]', desc: '🔥 Minta dimarahin Dospem Killer' },
                    { name: '!daily', desc: '💰 Klaim gaji harian (Gold gratis)' },
                ]
            },
            general: {
                title: '⚙️ Umum & Admin',
                description: 'Profil user dan pengaturan server.',
                cmds: [
                    { name: '!profile', desc: '💳 Lihat Kartu Mahasiswa (XP & Inventory)' },
                    { name: '!leaderboard', desc: '🏆 Ranking kekayaan & level se-fakultas' },
                    { name: '!tanya [soal]', desc: '🤖 Tanya AI bebas (General Purpose)' },
                    { name: '!jadwal', desc: '📅 Cek jadwal blok/kuliah' },
                    { name: '!rules', desc: '📜 (Admin) Post peraturan & verifikasi' },
                    { name: '!setuprole', desc: '🎓 (Admin) Menu pilih angkatan' },
                ]
            }
        };

        // --- 1. HALAMAN DEPAN ---
        const embedHome = new EmbedBuilder()
            .setColor(0x5865F2) // Blurple
            .setTitle('🤖 AMAMIYA SYSTEM V2.0')
            .setDescription(`Halo **${message.author.username}**, sistem operasional FKG siap membantu.\n\nSaat ini terdeteksi **${Object.values(commandsData).reduce((a,b) => a + b.cmds.length, 0)} modul perintah** aktif.\nSilakan pilih kategori di bawah untuk mengakses manual.`)
            .setThumbnail(message.client.user.displayAvatarURL())
            .addFields(
                { name: '📅 Tanggal', value: new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), inline: true },
                { name: '⚡ Latency', value: `${Date.now() - message.createdTimestamp}ms`, inline: true }
            )
            .setFooter({ text: 'Developed by Revanda • FKG Unsri' });

        // --- 2. DROPDOWN ---
        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_kategori')
                .setPlaceholder('📂 Pilih Modul Sistem...')
                .addOptions([
                    {
                        label: 'Akademik & Riset',
                        description: 'Katalog Skripsi, Jurnal, Kerangka, dll.',
                        value: 'akademik',
                        emoji: '📚'
                    },
                    {
                        label: 'Klinis & Praktek',
                        description: 'ICD-10, Dosis, OSCE, Kuis.',
                        value: 'klinis',
                        emoji: '🩺'
                    },
                    {
                        label: 'Hiburan (Games)',
                        description: 'Gacha, Duel, Daily, Khodam.',
                        value: 'fun',
                        emoji: '🎮'
                    },
                    {
                        label: 'Umum & Admin',
                        description: 'Profile, Leaderboard, Setup.',
                        value: 'general',
                        emoji: '⚙️'
                    },
                ])
        );

        const msg = await message.reply({ embeds: [embedHome], components: [selectMenu] });

        // --- 3. INTERACTION HANDLER ---
        const collector = msg.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect,
            time: 300000 // 5 Menit
        });

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '❌ Buka menu sendiri ketik `!menu`', ephemeral: true });
            }

            const category = i.values[0];
            const data = commandsData[category];

            // Render List Command
            const list = data.cmds.map(cmd => `> **\`${cmd.name}\`**\n> ${cmd.desc}`).join('\n\n');

            const embedPage = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle(data.title)
                .setDescription(`*${data.description}*\n\n${list}`)
                .setFooter({ text: 'Tips: Gunakan [spasi] setelah command untuk input parameter.' });

            await i.update({ embeds: [embedPage], components: [selectMenu] });
        });

        collector.on('end', () => {
            if(msg.editable) msg.edit({ content: '🔒 **Sesi berakhir.** Ketik `!menu` untuk membuka kembali.', components: [] });
        });
    },
};