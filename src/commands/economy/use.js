const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'use',
    description: 'Gunakan item dari tas inventory',
    async execute(message, args) {
        // Format: !use [item_id] [mention_user (opsional)]
        const itemId = args[0]?.toLowerCase();
        const targetUser = message.mentions.users.first() || message.author;

        if (!itemId) return message.reply("❌ Mau pakai apa? Cek tas dulu (`!tas`).\nContoh: `!use kopi`");

        // 1. Ambil Data User (Pemilik Item)
        let user = await User.findOne({ userId: message.author.id });
        if (!user || !user.inventory) return message.reply("🎒 Tas kamu kosong melompong.");

        // 2. Cari Item di Inventory
        // Kita cari index-nya biar gampang dihapus nanti
        const itemIndex = user.inventory.findIndex(i => i.itemId === itemId);
        
        if (itemIndex === -1) {
            return message.reply(`❌ Kamu tidak punya item dengan ID **${itemId}**.`);
        }

        const itemData = user.inventory[itemIndex];

        // --- 3. LOGIKA EFEK ITEM (RPG MECHANIC) ---
        let replyMsg = "";
        let embedColor = 0x95A5A6; // Abu default

        // CASE A: KOPI (Nambah XP)
        if (itemId === 'kopi') {
            const xpAmount = 50;
            user.xp += xpAmount; // Tambah ke diri sendiri
            
            replyMsg = `☕ **SLURP!** Segar!\n${message.author} meminum Kopi Kapal Api.\n**+${xpAmount} XP** (Mata jadi melek lagi!)`;
            embedColor = 0x6F4E37; // Coklat Kopi
        }
        
        // CASE B: LIDOCAINE (Prank Teman)
        else if (itemId === 'lidocaine') {
            if (targetUser.id === message.author.id) {
                return message.reply("💉 Jangan bius diri sendiri, bahaya!");
            }
            
            // Di sini kita main Roleplay Text aja (kalau mau mute beneran butuh permission admin)
            replyMsg = `💉 **CESS...**\n${message.author} menyuntikkan Lidocaine ke pantat **${targetUser.username}**!\n\n😵 **${targetUser.username}** sekarang mati rasa dan tidak bisa merasakan kakinya.`;
            embedColor = 0xE74C3C; // Merah Darah
        }

        // CASE C: ITEM LAIN (Default)
        else {
            return message.reply("🤔 Item ini sepertinya hanya pajangan (atau belum ada efeknya).");
        }

        // 4. HAPUS ITEM DARI TAS (Consumable)
        // Hapus 1 item dari array inventory
        user.inventory.splice(itemIndex, 1);
        await user.save();

        // 5. KIRIM PESAN RPG
        const embedAction = new EmbedBuilder()
            .setColor(embedColor)
            .setDescription(replyMsg)
            .setFooter({ text: `Sisa ${itemData.itemName} di tas: ${user.inventory.filter(i => i.itemId === itemId).length}` });

        return message.reply({ embeds: [embedAction] });
    },
};