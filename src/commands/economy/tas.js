const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../shared/models/User');
const Item = require('../../../shared/models/Item');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tas')
        .setDescription('Membuka tas untuk melihat seluruh aset medis dan barang habis pakai')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Pilih mahasiswa lain untuk menginspeksi tas mereka')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Mengunci sesi karena ada proses komputasi pengelompokan (Grouping) yang memakan waktu
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('target') || interaction.user;

        try {
            // 1. Tarik Data Inventaris Mahasiswa
            const user = await User.findOne({ userId: targetUser.id });

            if (!user || !user.inventory || user.inventory.length === 0) {
                return interaction.editReply(`🎒 **Inventaris Kosong:** Tas milik **${targetUser.username}** kosong melompong. Tidak ada aset yang ditemukan.`);
            }

            // 2. Kalkulasi Kuantitas Barang (Mengelompokkan barang yang sama)
            // Hasil: { "kopi": 5, "jas_lab": 1, "alginate": 3 }
            const itemCounts = {};
            const itemRarities = {};
            
            user.inventory.forEach(item => {
                const id = item.itemId.toLowerCase();
                itemCounts[id] = (itemCounts[id] || 0) + 1;
                // Simpan rarity untuk keperluan tampilan UI
                if (!itemRarities[id]) itemRarities[id] = item.rarity || 'Common';
            });

            // 3. Tarik Definisi Barang dari Database Pusat (Untuk mengetahui Platform dan Nama Asli)
            const uniqueItemIds = Object.keys(itemCounts);
            const itemDefinitions = await Item.find({ itemId: { $in: uniqueItemIds } });

            // 4. Proses Klasifikasi (Pemisahan Rak Roblox & Rak Discord)
            let robloxText = "";
            let discordText = "";

            for (const id of uniqueItemIds) {
                const qty = itemCounts[id];
                const rarity = itemRarities[id];
                
                // Cari definisi asli barang dari hasil query MongoDB
                const def = itemDefinitions.find(i => i.itemId.toLowerCase() === id);
                
                // Jika barang terhapus dari DB pusat, fallback ke data nama di inventory
                const itemName = def ? def.displayName : (user.inventory.find(i => i.itemId.toLowerCase() === id)?.itemName || id);
                const platform = def ? def.platform : 'roblox'; // Default ke roblox jika data hilang untuk keamanan

                // Menentukan indikator kelangkaan
                let rarityEmoji = '⚪';
                if (rarity === 'Uncommon') rarityEmoji = '🟢';
                if (rarity === 'Rare') rarityEmoji = '🔵';
                if (rarity === 'Epic') rarityEmoji = '🟣';
                if (rarity === 'Legendary') rarityEmoji = '🟡';

                const itemRow = `> ${rarityEmoji} **${itemName}** (x${qty})\n> └ ID: \`${id}\`\n\n`;

                // Klasifikasikan berdasarkan platform
                if (platform === 'discord' || platform === 'both') {
                    discordText += itemRow;
                } else {
                    robloxText += itemRow;
                }
            }

            // 5. Render Antarmuka Visual
            const embedInventory = new EmbedBuilder()
                .setColor('#3498DB') // Biru Inventaris
                .setTitle(`🎒 Tas Logistik: ${targetUser.username.toUpperCase()}`)
                .setDescription(`Sistem mendeteksi total **${user.inventory.length} item** di dalam inventaris. Aset telah diklasifikasikan berdasarkan platform operasional:`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setFooter({ 
                    text: 'Gunakan /use [id_barang] untuk memakai barang Discord.', 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            // Memasukkan Rak Roblox (Jika ada isinya)
            if (robloxText.length > 0) {
                embedInventory.addFields({
                    name: '🏥 ASET PRAKTIKUM KLINIS (ROBLOX)',
                    value: robloxText,
                    inline: false
                });
            }

            // Memasukkan Rak Discord (Jika ada isinya)
            if (discordText.length > 0) {
                embedInventory.addFields({
                    name: '🧪 BARANG HABIS PAKAI & PRANK (DISCORD)',
                    value: discordText,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embedInventory] });

        } catch (error) {
            console.error("Kesalahan Sistem Inventaris:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali saat memindai pangkalan data inventaris.");
        }
    },
};
