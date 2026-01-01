const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'perpus',
    description: 'Buka Repository Digital Skripsi KG UNSRI (Data Lengkap)',
    async execute(message, args) {
        
        // --- 1. LOAD & PROCESS DATA ---
        // Kita load file JSON mentah kamu apa adanya
        const dbPath = path.join(__dirname, '../../data/skripsi_db.json'); // Pastikan file json ada di folder data
        let rawData = [];
        let groupedData = {};

        try {
            const fileContent = fs.readFileSync(dbPath, 'utf8');
            rawData = JSON.parse(fileContent);

            // AUTO-GROUPING Logic
            // Kita ubah Array panjang menjadi Object terkelompok berdasarkan 'specialization'
            rawData.forEach(item => {
                // Ambil kategori, jika kosong masukkan ke 'Lain-lain'
                const category = item.specialization || 'Lain-lain';
                
                if (!groupedData[category]) {
                    groupedData[category] = [];
                }
                groupedData[category].push(item);
            });

        } catch (err) {
            console.error("Gagal load database:", err);
            return message.reply("❌ Database Skripsi belum diupload atau format salah.");
        }

        // --- 2. HALAMAN UTAMA (DASHBOARD) ---
        const totalSkripsi = rawData.length;
        const totalKategori = Object.keys(groupedData).length;

        // Urutkan nama kategori sesuai abjad biar rapi
        const sortedCategories = Object.keys(groupedData).sort();

        let statsText = "📚 **STATISTIK KOLEKSI:**\n";
        sortedCategories.forEach(cat => {
            statsText += `• **${cat}**: ${groupedData[cat].length} judul\n`;
        });

        const embedMain = new EmbedBuilder()
            .setColor(0x3498DB) // Biru Akademis
            .setTitle('🏛️ PERPUSTAKAAN DIGITAL KG UNSRI')
            .setDescription(`Selamat datang di Repository Skripsi.\nTotal tersimpan: **${totalSkripsi} Dokumen** dalam **${totalKategori} Departemen**.\n\nSilakan pilih **Departemen/Spesialisasi** di bawah ini untuk membuka rak buku.\n\n${statsText}\n\n**📔  Bank Diktat by PENDPRO**\nGunakan secara bijak. Dilarang menyebarluaskan kepada selain warga KG.\nhttps://drive.google.com/drive/folders/1Kp5nziIWlxFohay2dc479kNG40FGx0Ow`)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png') // Ikon Buku
            .setFooter({ text: 'Data Repository Universitas Sriwijaya' });

        // --- 3. KOMPONEN MENU ---
        
        // Buat opsi dropdown dari kategori yang ada
        const menuOptions = sortedCategories.map(cat => ({
            label: cat,
            description: `Lihat koleksi ${cat} (${groupedData[cat].length} Judul)`,
            value: cat,
            emoji: '📂'
        })).slice(0, 25); // Discord limit max 25 opsi menu

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_kategori')
                .setPlaceholder('🔍 Pilih Rak Departemen...')
                .addOptions(menuOptions)
        );

        // Tombol Navigasi
        const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('⬅️ Sebelumnya').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('home').setLabel('🏠 Beranda').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('next').setLabel('Selanjutnya ➡️').setStyle(ButtonStyle.Primary).setDisabled(true)
        );

        // Kirim Pesan Awal
        const msg = await message.reply({ embeds: [embedMain], components: [selectMenu] });

        // --- 4. INTERAKSI USER (COLLECTOR) ---
        const collector = msg.createMessageComponentCollector({ 
            time: 600000 // 10 Menit session
        });

        // State (Ingatan Bot untuk sesi ini)
        let currentCategory = null;
        let currentPage = 0;
        const ITEMS_PER_PAGE = 5; // Kita kurangi jadi 5 karena isinya lebih detail (biar gak kepanjangan)

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '❌ Buka menu sendiri dong ketik `!perpus`', ephemeral: true });
            }

            // LOGIKA GANTI KATEGORI (Dropdown)
            if (i.isStringSelectMenu()) {
                currentCategory = i.values[0];
                currentPage = 0;
            } 
            // LOGIKA GANTI HALAMAN (Tombol)
            else if (i.isButton()) {
                if (i.customId === 'prev') currentPage--;
                if (i.customId === 'next') currentPage++;
                if (i.customId === 'home') {
                    currentCategory = null;
                    currentPage = 0;
                    return i.update({ embeds: [embedMain], components: [selectMenu] });
                }
            }

            // RENDER ULANG TAMPILAN
            if (currentCategory) {
                const listData = groupedData[currentCategory];
                const totalPages = Math.ceil(listData.length / ITEMS_PER_PAGE);
                
                // Safety check page
                if (currentPage < 0) currentPage = 0;
                if (currentPage >= totalPages) currentPage = totalPages - 1;

                // Potong data sesuai halaman
                const start = currentPage * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const pageItems = listData.slice(start, end);

                // Format Tampilan List (RICH FORMAT)
                // [Judul](URL)
                // 👤 Penulis | 🗓️ Tahun
                const listText = pageItems.map((item, index) => {
                    // Ambil penulis pertama saja biar gak kepanjangan, atau 'et al.'
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

                // Update status tombol
                const updatedButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('home').setLabel('🏠 Menu').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
                );

                await i.update({ embeds: [embedList], components: [selectMenu, updatedButtons] });
            }
        });

        collector.on('end', () => {
            if(msg.editable) msg.edit({ content: '⚠️ **Sesi Perpustakaan Ditutup.** Ketik `!perpus` untuk buka lagi.', components: [] });
        });
    },
};