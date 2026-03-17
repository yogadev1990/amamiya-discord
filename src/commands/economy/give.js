const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Memberikan peralatan medis atau item kepada rekan sejawat')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Pilih mahasiswa penerima barang')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('item_id')
                .setDescription('Ketik ID barang yang ingin diberikan (Contoh: kaca_mulut)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('jumlah')
                .setDescription('Jumlah barang yang dikirim (Default: 1)')
                .setRequired(false)
                .setMinValue(1) // Mutlak tidak bisa mengirim minus
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('target');
        const itemId = interaction.options.getString('item_id').toLowerCase();
        const amount = interaction.options.getInteger('jumlah') || 1;

        // --- VALIDASI LOGIKA ---
        if (target.id === interaction.user.id) return interaction.editReply("❌ **Sistem Menolak:** Anda tidak dapat mengirim barang kepada diri sendiri.");
        if (target.bot) return interaction.editReply("🤖 **Sistem Menolak:** Entitas AI tidak membutuhkan material fana.");

        try {
            // --- EKSEKUSI DATABASE ---
            const sender = await User.findOne({ userId: interaction.user.id });
            if (!sender || !sender.inventory || sender.inventory.length === 0) {
                return interaction.editReply("🎒 **Inventaris Kosong:** Anda tidak memiliki barang apapun untuk diberikan.");
            }

            let receiver = await User.findOne({ userId: target.id });
            if (!receiver) {
                // Membangun akun otomatis untuk penerima jika belum ada
                receiver = new User({ userId: target.id, username: target.username, gold: 1000, inventory: [] });
            }

            // --- KALKULASI KETERSEDIAAN BARANG ---
            const senderItems = sender.inventory.filter(i => i.itemId === itemId);
            if (senderItems.length < amount) {
                return interaction.editReply(`❌ **Defisit Stok:** Anda hanya memiliki **${senderItems.length}** unit barang dengan ID \`${itemId}\`. Transaksi dibatalkan.`);
            }

            // --- PROSES PEMINDAHAN MUTLAK ---
            const itemsToMove = [];
            const sampleItem = senderItems[0]; 
            let removedCount = 0;

            // Memindai inventaris dari belakang untuk mencegah pergeseran indeks saat menghapus item
            for (let i = sender.inventory.length - 1; i >= 0; i--) {
                if (removedCount >= amount) break; 
                
                if (sender.inventory[i].itemId === itemId) {
                    itemsToMove.push(sender.inventory[i]); 
                    sender.inventory.splice(i, 1);
                    removedCount++;
                }
            }

            // Injeksi barang ke inventaris penerima
            receiver.inventory.push(...itemsToMove);

            // Simpan perubahan ke pangkalan data
            await sender.save();
            await receiver.save();

            // --- RENDER ANTARMUKA LOG ---
            const embedSuccess = new EmbedBuilder()
                .setColor('#3498DB') // Biru Logistik
                .setTitle('📦 LOGISTIK TERKIRIM')
                .setDescription(`Pengiriman aset dari **${interaction.user.username}** kepada **${target.username}** telah dikonfirmasi oleh sistem.`)
                .addFields(
                    { name: '🛒 Nama Barang', value: sampleItem.itemName || itemId, inline: true },
                    { name: '🔢 Kuantitas', value: `${amount} Unit`, inline: true },
                    { name: '✨ Kelangkaan', value: sampleItem.rarity || 'Common', inline: true }
                )
                .setFooter({ text: 'Sistem Manajemen Inventaris Amamiya' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embedSuccess] });

        } catch (error) {
            console.error("Kesalahan Transfer Item:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali pada pangkalan data saat memproses transaksi.");
        }
    },
};
