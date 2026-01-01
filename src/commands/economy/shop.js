const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

// --- DATABASE BARANG DAGANGAN ---
// Tips: ID harus unik, jangan pakai spasi
const shopItems = [
    { 
        id: 'kopi', 
        name: '☕ Kopi Sachet', 
        price: 200, 
        desc: 'Menghilangkan ngantuk. (+50 XP Instan)',
        type: 'consumable' 
    },
    { 
        id: 'vitamin', 
        name: '💉 Vitamin C Dosis Tinggi', 
        price: 1000, 
        desc: 'Otak jadi encer. (XP Boost 2x selama 1 jam)',
        type: 'consumable' 
    },
    { 
        id: 'lidocaine', 
        name: '🤫 Lidocaine (Obat Bius)', 
        price: 750, 
        desc: 'Suntik temanmu biar diam. (Mute user lain 5 menit)',
        type: 'tool' 
    },
    { 
        id: 'sultan', 
        name: '👑 Sertifikat Sultan', 
        price: 50000, 
        desc: 'Bukti kekayaan mutlak. (Dapat Role "Donatur" permanen)',
        type: 'role' 
    }
];

module.exports = {
    name: 'shop',
    description: 'Belanja kebutuhan di Koperasi Amamiya',
    async execute(message, args) {
        const subCommand = args[0]?.toLowerCase(); // !shop [buy/list]
        const itemCode = args[1]?.toLowerCase();   // !shop buy [id]
        const amount = parseInt(args[2]) || 1;     // !shop buy [id] [jumlah]

        // --- 1. TAMPILKAN DAFTAR BARANG (!shop) ---
        if (!subCommand || subCommand === 'list') {
            const embedShop = new EmbedBuilder()
                .setColor(0x2ECC71) // Hijau Duit
                .setTitle('🏪 KOPERASI MAHASISWA AMAMIYA')
                .setDescription('Gunakan uang hasil kerja kerasmu di sini.\nCara beli: `!shop buy [id_barang] [jumlah]`')
                .setFooter({ text: 'Barang yang sudah dibeli tidak bisa direfund!' });

            // Loop items buat bikin field otomatis
            shopItems.forEach(item => {
                embedShop.addFields({
                    name: `${item.name} — 💰 ${item.price} Gold`,
                    value: `🆔 ID: \`${item.id}\`\n📝 ${item.desc}`,
                    inline: false
                });
            });

            return message.reply({ embeds: [embedShop] });
        }

        // --- 2. FITUR BELI (!shop buy) ---
        if (subCommand === 'buy') {
            if (!itemCode) return message.reply("❌ Mau beli apa? Cek ID barang di `!shop` dulu.");

            // Cari barang di database lokal
            const itemToBuy = shopItems.find(i => i.id === itemCode);
            if (!itemToBuy) return message.reply("❌ Barang tidak ditemukan! Cek ejaan ID-nya.");

            // Hitung total harga
            const totalPrice = itemToBuy.price * amount;

            // Ambil data user dari DB
            let user = await User.findOne({ userId: message.author.id });
            if (!user) return message.reply("❌ Kamu belum punya akun. Ketik `!daily` dulu.");

            // Cek Uang
            if (user.gold < totalPrice) {
                return message.reply(`💸 **Uang Gak Cukup!**\nHarga: ${totalPrice}\nUangmu: ${user.gold}`);
            }

            // --- PROSES TRANSAKSI ---
            
            // A. Kurangi Uang
            user.gold -= totalPrice;

            // B. Masukkan ke Inventory
            // Kita cek dulu apakah item sudah ada di inventory (kalau mau ditumpuk/stack)
            // Tapi untuk simpelnya, kita push object baru aja.
            
            // Format item di inventory disamakan dengan Gacha biar konsisten
            for (let i = 0; i < amount; i++) {
                user.inventory.push({
                    itemId: itemToBuy.id,
                    itemName: itemToBuy.name,
                    rarity: 'Shop Item', // Rarity khusus barang toko
                    type: itemToBuy.type // Simpan tipe buat logic !use nanti
                });
            }

            // C. Khusus Item "Langsung Pakai" (Opsional, misal XP instan)
            let extraMsg = "";
            if (itemToBuy.id === 'kopi') {
                user.xp += (50 * amount); // Langsung nambah XP
                // Hapus item dari inventory karena langsung diminum (opsional logic)
                // user.inventory.pop(); 
                extraMsg = `\n🆙 **+${50 * amount} XP** langsung masuk ke tubuhmu!`;
            }

            await user.save();

            const embedSuccess = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('✅ PEMBELIAN BERHASIL')
                .setDescription(`Kamu membeli **${amount}x ${itemToBuy.name}**\nTotal Bayar: **${totalPrice} Gold**${extraMsg}`)
                .setFooter({ text: `Sisa Saldo: ${user.gold} Gold | Cek tas: !tas` });

            return message.reply({ embeds: [embedSuccess] });
        }
    },
};