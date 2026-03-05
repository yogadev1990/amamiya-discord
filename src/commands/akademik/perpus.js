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
                    { name: 'Repository Skripsi', value: 'skripsi' },
                    { name: 'Bank Diktat PENDPRO', value: 'diktat' },
                    { name: 'Library Digital Ebook (Kavita)', value: 'kavita' }
                )
        ),

    async execute(interaction) {
        const pilihanLayanan = interaction.options.getString('layanan');

        // --- OPSI 1: KAVITA EBOOK ---
        if (pilihanLayanan === 'kavita') {
            const embedKavita = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('📚 Library Digital Ebook (Kavita)')
                .setDescription('Akses koleksi Ebook digital melalui platform Kavita.\n\n🔗 **Link Akses:** [library.revanetic.my.id](https://library.revanetic.my.id)')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2097/2097068.png');
            
            return interaction.reply({ embeds: [embedKavita] });
        }

        // --- OPSI 2: BANK DIKTAT ---
        if (pilihanLayanan === 'diktat') {
            const embedDiktat = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('📔 Bank Diktat by PENDPRO')
                .setDescription('Kumpulan diktat untuk warga KG.\n\n⚠️ **Peringatan:** Gunakan secara bijak. Dilarang menyebarluaskan kepada selain warga KG.\n\n🔗 **Link Akses:** [Google Drive PENDPRO](https://drive.google.com/drive/folders/1Kp5nziIWlxFohay2dc479kNG40FGx0Ow)');
            
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
                .setFooter({ text: 'Data Repository Universitas Sriwijaya' });

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