const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perpus')
        .setDescription('Buka layanan Perpustakaan Digital (Skripsi, Diktat, Ebook)')
        .addStringOption(option =>
            option.setName('layanan')
                .setDescription('Pilih layanan yang ingin dibuka')
                .setRequired(true)
                .addChoices(
                    { name: 'Skripsi', value: 'skripsi' },
                    { name: 'Bank Diktat', value: 'diktat' },
                    { name: 'Library Digital Ebook', value: 'kavita' }
                )
        ),

    async execute(interaction) {
        const pilihanLayanan = interaction.options.getString('layanan');

// --- OPSI 1: CALIBRE-WEB (Berdasarkan Rak Publik) ---
        if (pilihanLayanan === 'kavita') {
            const Database = require('better-sqlite3');
            
            // Path menuju kedua database
            const dbAppPath = '/calibre_web_config/app.db'; 
            const dbCalibrePath = '/calibre_db/metadata.db';

            let groupedData = {};
            let totalBooksInShelves = 0;

            try {
                // Buka database Calibre-Web (app.db)
                const db = new Database(dbAppPath, { readonly: true });
                
                // Tempelkan database utama Calibre agar bisa membaca judul buku
                db.prepare(`ATTACH DATABASE '${dbCalibrePath}' AS metadata`).run();
                
                // Ekstrak data Rak Publik beserta isi bukunya
                const rows = db.prepare(`
                    SELECT s.name AS shelf_name, b.title AS book_title
                    FROM shelf s
                    JOIN book_shelf_link bsl ON s.id = bsl.shelf_id
                    JOIN metadata.books b ON bsl.book_id = b.id
                    WHERE s.is_public = 1
                    ORDER BY s.name ASC, b.title ASC
                `).all();

                rows.forEach(row => {
                    const category = row.shelf_name || 'Rak Tidak Bernama';
                    if (!groupedData[category]) {
                        groupedData[category] = [];
                    }
                    groupedData[category].push({ title: row.book_title });
                });
                
                totalBooksInShelves = rows.length;
                db.close();
            } catch (err) {
                console.error("Gagal membaca database Rak Calibre-Web:", err);
                return interaction.reply({ content: "❌ Database Rak Publik sedang tidak dapat diakses.", ephemeral: true });
            }

            const totalKategori = Object.keys(groupedData).length;
            const sortedCategories = Object.keys(groupedData).sort();

            if (totalKategori === 0) {
                return interaction.reply({ content: "⚠️ Belum ada Rak Publik yang dibuat atau rak masih kosong di Calibre-Web.", ephemeral: true });
            }

            let statsText = "📚 **DAFTAR RAK PUBLIK:**\n";
            sortedCategories.forEach(cat => {
                statsText += `• **${cat}**: ${groupedData[cat].length} buku\n`;
            });

            const embedMain = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('📚 RAK PERPUSTAKAAN DIGITAL')
                .setDescription(`Menampilkan Koleksi Berdasarkan Rak Publik.\nTotal Koleksi Tersusun: **${totalBooksInShelves} Buku** dalam **${totalKategori} Rak**.\n\nSilakan pilih **Rak** pada menu di bawah untuk melihat isi buku.\n\n${statsText}\n🔗 **Akses Penuh:** [library.revanetic.my.id](https://library.revanetic.my.id)`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2097/2097068.png')
                .setFooter({ text: 'Amamiya by Revanda' });

            const menuOptions = sortedCategories.map(cat => ({
                label: cat.length > 25 ? cat.substring(0, 22) + '...' : cat,
                description: `${groupedData[cat].length} Buku`,
                value: cat.length > 100 ? cat.substring(0, 99) : cat,
                emoji: '🗂️'
            })).slice(0, 25);

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_rak')
                    .setPlaceholder('🔍 Buka Rak...')
                    .addOptions(menuOptions)
            );

            const msg = await interaction.reply({ embeds: [embedMain], components: [selectMenu], fetchReply: true });
            const collector = msg.createMessageComponentCollector({ time: 600000 }); // 10 Menit

            let currentCategory = null;
            let currentPage = 0;
            const ITEMS_PER_PAGE = 5;

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ Akses ditolak.', ephemeral: true });
                }

                if (i.isStringSelectMenu()) {
                    currentCategory = i.values[0];
                    currentPage = 0;
                } else if (i.isButton()) {
                    if (i.customId === 'prev') currentPage--;
                    if (i.customId === 'next') currentPage++;
                    if (i.customId === 'home') {
                        currentCategory = null;
                        currentPage = 0;
                        return i.update({ embeds: [embedMain], components: [selectMenu] });
                    }
                }

                if (currentCategory) {
                    const listData = groupedData[currentCategory];
                    const totalPages = Math.ceil(listData.length / ITEMS_PER_PAGE);
                    
                    if (currentPage < 0) currentPage = 0;
                    if (currentPage >= totalPages) currentPage = totalPages - 1;

                    const start = currentPage * ITEMS_PER_PAGE;
                    const end = start + ITEMS_PER_PAGE;
                    const pageItems = listData.slice(start, end);

                    const listText = pageItems.map((item, index) => {
                        return `**${start + index + 1}. ${item.title}**`;
                    }).join('\n\n');

                    const embedList = new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle(`🗂️ Rak: ${currentCategory}`)
                        .setDescription(listText || "Rak kosong.")
                        .setFooter({ text: `Halaman ${currentPage + 1} dari ${totalPages} • Total ${listData.length} Buku` });

                    const updatedButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Sebelumnya').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('home').setLabel('🏠 Beranda').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('next').setLabel('Selanjutnya ➡️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
                    );

                    await i.update({ embeds: [embedList], components: [selectMenu, updatedButtons] });
                }
            });

            collector.on('end', () => {
                interaction.editReply({ content: '⚠️ **Sesi Rak Buku Ditutup.**', components: [] }).catch(() => {});
            });
            return;
        }

        // --- OPSI 2: BANK DIKTAT ---
        if (pilihanLayanan === 'diktat') {
            const embedDiktat = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('📔 Bank Diktat by PENDPRO')
                .setDescription('Kumpulan diktat untuk warga KG.\n\n⚠️ **Peringatan:** Gunakan secara bijak. Dilarang menyebarluaskan kepada selain warga KG.\n\n🔗 **Link Akses:** [Google Drive PENDPRO](https://drive.google.com/drive/folders/1Kp5nziIWlxFohay2dc479kNG40FGx0Ow)').setFooter({ text: 'Amamiya by Revanda' });;
            
            return interaction.reply({ embeds: [embedDiktat] });
        }

        // --- OPSI 3: REPOSITORY SKRIPSI ---
        if (pilihanLayanan === 'skripsi') {
            const dbPath = path.join(__dirname, '../../data/skripsi_db.json');
            let rawData = [];
            let groupedData = {};

            try {
                const fileContent = fs.readFileSync(dbPath, 'utf8');
                rawData = JSON.parse(fileContent);

                rawData.forEach(item => {
                    const category = item.specialization || 'Lain-lain';
                    if (!groupedData[category]) {
                        groupedData[category] = [];
                    }
                    groupedData[category].push(item);
                });
            } catch (err) {
                console.error("Gagal load database:", err);
                return interaction.reply({ content: "❌ Database Skripsi belum diupload atau format salah.", ephemeral: true });
            }

            const totalSkripsi = rawData.length;
            const totalKategori = Object.keys(groupedData).length;
            const sortedCategories = Object.keys(groupedData).sort();

            let statsText = "📚 **STATISTIK KOLEKSI:**\n";
            sortedCategories.forEach(cat => {
                statsText += `• **${cat}**: ${groupedData[cat].length} judul\n`;
            });

            const embedMain = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🏛️ PERPUSTAKAAN DIGITAL KG UNSRI')
                .setDescription(`Selamat datang di Repository Skripsi.\nTotal tersimpan: **${totalSkripsi} Dokumen** dalam **${totalKategori} Departemen**.\n\nSilakan pilih **Departemen/Spesialisasi** di bawah ini untuk membuka rak buku.\n\n${statsText}`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                .setFooter({ text: 'Amamiya by Revanda' });

            const menuOptions = sortedCategories.map(cat => ({
                label: cat,
                description: `Lihat koleksi ${cat} (${groupedData[cat].length} Judul)`,
                value: cat,
                emoji: '📂'
            })).slice(0, 25);

            const selectMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_kategori')
                    .setPlaceholder('🔍 Pilih Rak Departemen...')
                    .addOptions(menuOptions)
            );

            // fetchReply wajib true agar kita bisa menempelkan collector pada pesan balasan bot
            const msg = await interaction.reply({ embeds: [embedMain], components: [selectMenu], fetchReply: true });

            const collector = msg.createMessageComponentCollector({ time: 600000 }); // 10 Menit

            let currentCategory = null;
            let currentPage = 0;
            const ITEMS_PER_PAGE = 5;

            collector.on('collect', async i => {
                // Validasi agar hanya user pembuat command yang bisa klik
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ Akses ditolak. Ketik `/perpus` sendiri untuk membuka perpustakaan.', ephemeral: true });
                }

                if (i.isStringSelectMenu()) {
                    currentCategory = i.values[0];
                    currentPage = 0;
                } else if (i.isButton()) {
                    if (i.customId === 'prev') currentPage--;
                    if (i.customId === 'next') currentPage++;
                    if (i.customId === 'home') {
                        currentCategory = null;
                        currentPage = 0;
                        return i.update({ embeds: [embedMain], components: [selectMenu] });
                    }
                }

                if (currentCategory) {
                    const listData = groupedData[currentCategory];
                    const totalPages = Math.ceil(listData.length / ITEMS_PER_PAGE);
                    
                    if (currentPage < 0) currentPage = 0;
                    if (currentPage >= totalPages) currentPage = totalPages - 1;

                    const start = currentPage * ITEMS_PER_PAGE;
                    const end = start + ITEMS_PER_PAGE;
                    const pageItems = listData.slice(start, end);

                    const listText = pageItems.map((item, index) => {
                        const penulis = Array.isArray(item.authors) ? item.authors[0] : (item.authors || 'Tanpa Nama');
                        const tahun = item.year || '????';
                        const link = item.url || '#';
                        return `**${start + index + 1}. [${item.title}](${link})**\n   👤 *${penulis}* | 🗓️ ${tahun}`;
                    }).join('\n\n');

                    const embedList = new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle(`📂 Departemen: ${currentCategory}`)
                        .setDescription(listText || "Belum ada data.")
                        .setFooter({ text: `Halaman ${currentPage + 1} dari ${totalPages} • Total ${listData.length} Judul` });

                    const updatedButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Sebelumnya').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('home').setLabel('🏠 Beranda').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('next').setLabel('Selanjutnya ➡️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
                    );

                    await i.update({ embeds: [embedList], components: [selectMenu, updatedButtons] });
                }
            });

            collector.on('end', () => {
                interaction.editReply({ content: '⚠️ **Sesi Perpustakaan Ditutup.** Ketik `/perpus` untuk buka lagi.', components: [] }).catch(() => {});
            });
        }
    },
};