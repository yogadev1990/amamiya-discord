const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const Item = require('../../models/Item'); // Wajib: Pastikan model Item sudah ada

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Gunakan barang konsumsi atau luncurkan item medis ke teman')
        .addStringOption(option =>
            option.setName('item_id')
                .setDescription('Ketik ID barang (Contoh: kopi, alginate, lidocaine, tang_cabut)')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Pilih korban jika item membutuhkan target fisik')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const itemId = interaction.options.getString('item_id').toLowerCase();
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const client = interaction.client;

        try {
            // 1. Validasi Pemilik & Tas
            let user = await User.findOne({ userId: interaction.user.id });
            if (!user || !user.inventory || user.inventory.length === 0) {
                return interaction.editReply("🎒 **Inventaris Kosong:** Anda tidak memiliki item apapun.");
            }

            const itemIndex = user.inventory.findIndex(i => i.itemId.toLowerCase() === itemId);
            if (itemIndex === -1) {
                return interaction.editReply(`❌ **Stok Kosong:** Item dengan ID **\`${itemId}\`** tidak ditemukan di tas Anda.`);
            }

            const itemData = user.inventory[itemIndex];
            
            // Coba ambil dari DB Item jika sudah ada
            const itemDef = await Item.findOne({ itemId: itemData.itemId });
            if (itemDef && itemDef.platform === 'roblox') isRobloxPlatform = true;

            if (isRobloxPlatform) {
                return interaction.editReply(`⚠️ **Akses Ditolak:** Alat **${itemData.itemName}** adalah aset klinis permanen. Hanya bisa digunakan di dalam server praktikum Roblox.`);
            }

            // 3. LOGIKA EFEK
            let replyMsg = "";
            let embedColor = '#95A5A6';
            let requireSaveTarget = false;
            let targetData = null;

            if (itemId === 'kopi') {
                const xpAmount = 50;
                user.xp += xpAmount;
                replyMsg = `☕ **SLURP!**\n<@${interaction.user.id}> meminum Kopi pekat.\nSistem menginjeksi **+${xpAmount} XP** ke dalam profil Anda.`;
                embedColor = '#6F4E37';
            }
            else if (itemId === 'alginate') {
                if (targetUser.id === interaction.user.id) return interaction.editReply("🥣 **Ditolak:** Anda tidak bisa mencetak mulut Anda sendiri.");
                
                // Set durasi 5 menit (300000 ms)
                client.alginateGags.set(targetUser.id, Date.now() + 300000);
                
                replyMsg = `🥣 **SPLAT!**\n<@${interaction.user.id}> menyumpal mulut <@${targetUser.id}> dengan Alginate!\n\n🤐 Mulut korban terkunci. Selama 5 menit ke depan, obrolannya akan menjadi gumaman!`;
                embedColor = '#FFC0CB';
            }
            else if (itemId === 'lidocaine') {
                if (targetUser.id === interaction.user.id) return interaction.editReply("💉 **Ditolak:** Jangan membius diri sendiri.");
                
                // Set durasi 10 menit (600000 ms)
                client.lidocaineNumbs.set(targetUser.id, Date.now() + 600000);
                
                replyMsg = `💉 **CESS...**\n<@${interaction.user.id}> menyuntikkan Lidocaine ke <@${targetUser.id}>!\n\n😵 Korban mati rasa. Selama 10 menit ke depan, korban **TIDAK AKAN MENDAPATKAN XP** dari pesan apapun.`;
                embedColor = '#E74C3C';
            }
            else if (itemId === 'tang_cabut') {
                if (targetUser.id === interaction.user.id) return interaction.editReply("🦷 **Ditolak:** Anda tidak bisa mencabut gigi sendiri.");
                
                targetData = await User.findOne({ userId: targetUser.id });
                if (!targetData || targetData.gold < 50) return interaction.editReply(`❌ **Gagal:** <@${targetUser.id}> terlalu miskin (Gold < 50) untuk dicuri giginya.`);

                targetData.gold -= 50;
                user.gold += 50;
                requireSaveTarget = true; 

                replyMsg = `🩸 **KRAK!**\n<@${interaction.user.id}> mencabut gigi geraham <@${targetUser.id}> secara paksa!\n\n💰 Gigi dijual. Anda mendapat **+50 Gold**, korban kehilangan **-50 Gold**!`;
                embedColor = '#8B0000';
            }
            else {
                replyMsg = `✅ Anda mengeluarkan **${itemData.itemName}**.`;
            }

            // 4. PENGHAPUSAN BARANG & PENYIMPANAN
            user.inventory.splice(itemIndex, 1);
            await user.save();
            if (requireSaveTarget && targetData) await targetData.save();

            const embedAction = new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(replyMsg)
                .setFooter({ text: `Sisa ${itemData.itemName}: ${user.inventory.filter(i => i.itemId === itemId).length}` });

            await interaction.editReply({ embeds: [embedAction] });

        } catch (error) {
            console.error("Kesalahan Sistem Penggunaan Item:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali saat memproses eksekusi item.");
        }
    },
};