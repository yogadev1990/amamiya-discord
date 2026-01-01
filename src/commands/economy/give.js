const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'give',
    description: 'Berikan item dari tasmu ke teman.',
    async execute(message, args) {
        // Format: !give @user [item_id] [jumlah (opsional, default 1)]
        const target = message.mentions.users.first();
        const itemId = args[1]?.toLowerCase();
        let amount = parseInt(args[2]);

        // --- VALIDASI ---
        if (!target) return message.reply("❌ Tag teman yang mau dikasih.\nContoh: `!give @Siti kopi`");
        if (!itemId) return message.reply("❌ Masukkan ID barang yang mau dikasih.");
        if (!amount || isNaN(amount) || amount < 1) amount = 1;

        if (target.id === message.author.id) return message.reply("❌ Simpan aja sendiri.");
        if (target.bot) return message.reply("🤖 Aku tidak butuh barang fana.");

        // --- DATABASE ---
        const sender = await User.findOne({ userId: message.author.id });
        let receiver = await User.findOne({ userId: target.id });

        if (!sender || !sender.inventory) return message.reply("🎒 Tas kamu kosong.");

        // Kalau penerima belum ada akun, buatkan
        if (!receiver) {
            receiver = await User.create({ userId: target.id, username: target.username, gold: 1000, inventory: [] });
        }

        // --- CEK KETERSEDIAAN BARANG ---
        // Kita hitung dulu sender punya berapa barang dengan ID tersebut
        const senderItems = sender.inventory.filter(i => i.itemId === itemId);
        
        if (senderItems.length < amount) {
            return message.reply(`❌ **Stok Kurang!**\nKamu cuma punya **${senderItems.length}** item dengan ID \`${itemId}\`.\nKamu mau kasih **${amount}**.`);
        }

        // --- PROSES PEMINDAHAN (TRANSAKSI) ---
        // Karena inventory bentuknya Array of Objects, kita harus pindahkan satu-satu
        const itemsToMove = [];
        
        // Ambil data detail item (nama, rarity) dari salah satu sampel
        const sampleItem = senderItems[0]; 

        // 1. Hapus dari Sender
        let removedCount = 0;
        // Loop backward biar aman saat splice array
        for (let i = sender.inventory.length - 1; i >= 0; i--) {
            if (removedCount >= amount) break; // Sudah cukup
            
            if (sender.inventory[i].itemId === itemId) {
                // Hapus dan simpan ke temporary array
                itemsToMove.push(sender.inventory[i]); 
                sender.inventory.splice(i, 1);
                removedCount++;
            }
        }

        // 2. Masukkan ke Receiver
        // Kita push object yang tadi diambil
        itemsToMove.forEach(item => {
            receiver.inventory.push(item);
        });

        await sender.save();
        await receiver.save();

        // --- LOG ---
        const embed = new EmbedBuilder()
            .setColor(0x3498DB) // Biru
            .setTitle('🎁 GIFT SENT!')
            .setDescription(`**${message.author.username}** memberikan hadiah kepada **${target.username}**.`)
            .addFields(
                { name: 'Barang', value: `${sampleItem.itemName}`, inline: true },
                { name: 'Jumlah', value: `${amount} pcs`, inline: true },
                { name: 'Rarity', value: `${sampleItem.rarity || 'Common'}`, inline: true }
            );

        message.reply({ embeds: [embed] });
    },
};