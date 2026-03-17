const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../../shared/models/User'); 
const Item = require('../../../shared/models/Item'); // Model Item yang baru saja kita buat

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Koperasi Peralatan Medis FKG (Terintegrasi dengan Praktikum Roblox)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Melihat katalog lengkap peralatan medis yang tersedia')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('buy')
                .setDescription('Membeli peralatan medis menggunakan saldo Gold')
                .addStringOption(option =>
                    option.setName('item_id')
                        .setDescription('Ketik ID barang yang ingin dibeli (Contoh: kaca_mulut)')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('jumlah')
                        .setDescription('Jumlah barang yang ingin dibeli (Default: 1)')
                        .setRequired(false)
                        .setMinValue(1) // Mencegah pembelian minus
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const subCommand = interaction.options.getSubcommand();

        try {
            // --- LOGIKA 1: MENAMPILKAN KATALOG (/shop list) ---
            if (subCommand === 'list') {
                // Menarik semua item dari MongoDB yang status isBuyable = true
                const shopItems = await Item.find({ isBuyable: true }).sort({ price: 1 });

                if (!shopItems || shopItems.length === 0) {
                    return interaction.editReply("⚠️ **Koperasi Kosong:** Belum ada barang yang diunggah ke database.");
                }

                const embedShop = new EmbedBuilder()
                    .setColor('#2ECC71') // Hijau Transaksi
                    .setTitle('🏪 KOPERASI MAHASISWA AMAMIYA')
                    .setDescription('Selamat datang di Koperasi FKG. Semua peralatan yang Anda beli di sini akan otomatis masuk ke inventaris karakter Roblox Anda.\n\nGunakan perintah `/shop buy [item_id]` untuk membeli perlengkapan.')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3081/3081986.png')
                    .setFooter({ text: 'Sistem Integrasi Ekonomi Amamiya' })
                    .setTimestamp();

                // Memasukkan setiap barang dari database ke dalam UI Embed
                shopItems.forEach(item => {
                    // Menambahkan warna atau emoji berdasarkan kelangkaan (Rarity)
                    let rarityEmoji = '⚪';
                    if (item.rarity === 'Uncommon') rarityEmoji = '🟢';
                    if (item.rarity === 'Rare') rarityEmoji = '🔵';
                    if (item.rarity === 'Epic') rarityEmoji = '🟣';

                    embedShop.addFields({
                        name: `${rarityEmoji} ${item.displayName} — 💰 ${item.price} Gold`,
                        value: `> 🆔 ID: **\`${item.itemId}\`**\n> 📦 Kategori: ${item.category}\n> 📝 *${item.description}*`,
                        inline: false
                    });
                });

                return interaction.editReply({ embeds: [embedShop] });
            }

            // --- LOGIKA 2: MEMBELI BARANG (/shop buy) ---
            if (subCommand === 'buy') {
                const itemCode = interaction.options.getString('item_id');
                const amount = interaction.options.getInteger('jumlah') || 1;

                // Memverifikasi apakah barang yang dicari ada di Database Item
                const itemToBuy = await Item.findOne({ itemId: itemCode, isBuyable: true });
                if (!itemToBuy) {
                    return interaction.editReply(`❌ **Transaksi Ditolak:** Barang dengan ID **\`${itemCode}\`** tidak ditemukan di etalase koperasi.`);
                }

                const totalPrice = itemToBuy.price * amount;

                // Memverifikasi akun pengguna
                let user = await User.findOne({ userId: interaction.user.id });
                if (!user) {
                    return interaction.editReply("❌ **Akses Ditolak:** Anda belum terdaftar di sistem akademik. Silakan kirim pesan apapun terlebih dahulu untuk memicu pembuatan profil otomatis.");
                }

                // Memverifikasi Saldo Gold
                if (user.gold < totalPrice) {
                    return interaction.editReply(`💸 **Saldo Tidak Mencukupi!**\nTotal Tagihan: **${totalPrice} Gold**\nSaldo Anda saat ini: **${user.gold} Gold**`);
                }

                // Eksekusi Pemotongan Saldo
                user.gold -= totalPrice;

                // Eksekusi Penyimpanan Barang ke Inventaris Pengguna
                // (Menambahkan barang ke dalam array inventory)
                for (let i = 0; i < amount; i++) {
                    user.inventory.push({
                        itemId: itemToBuy.itemId,
                        itemName: itemToBuy.displayName,
                        rarity: itemToBuy.rarity,
                        category: itemToBuy.category 
                    });
                }

                await user.save();

                const embedSuccess = new EmbedBuilder()
                    .setColor('#F1C40F') // Emas Transaksi Berhasil
                    .setTitle('✅ PEMBELIAN BERHASIL')
                    .setDescription(`Faktur pembelian atas nama **${interaction.user.username}** telah dicetak. Barang telah dikirim ke tas Anda.`)
                    .addFields(
                        { name: '🛒 Barang', value: `${amount}x ${itemToBuy.displayName}`, inline: true },
                        { name: '💳 Total Pembayaran', value: `${totalPrice} Gold`, inline: true },
                        { name: '💰 Sisa Saldo', value: `${user.gold} Gold`, inline: true }
                    )
                    .setFooter({ text: 'Barang yang dibeli akan otomatis tersinkronisasi saat Anda masuk ke Roblox' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embedSuccess] });
            }

        } catch (error) {
            console.error("Kesalahan Sistem Koperasi Amamiya:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali saat menghubungi pangkalan data ekonomi.");
        }
    },
};
