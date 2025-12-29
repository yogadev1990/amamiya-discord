const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

// --- DATABASE ITEM GACHA ---
const itemsPool = {
    common: [
        { id: 'masker_bedah', name: '😷 Masker Bedah Ijo', emoji: '😷' },
        { id: 'handscoon', name: '🧤 Handscoon Sobek Dikit', emoji: '🧤' },
        { id: 'cotton_roll', name: '☁️ Cotton Roll Basah', emoji: '☁️' },
        { id: 'gelas_kumur', name: '🥤 Gelas Kumur Plastik', emoji: '🥤' },
        { id: 'dental_bib', name: '🧻 Dental Bib', emoji: '🧻' },
    ],
    rare: [
        { id: 'kaca_mulut', name: '🔍 Kaca Mulut No. 4', emoji: '🔍' },
        { id: 'sonde_half', name: '🪝 Sonde Half Moon', emoji: '🪝' },
        { id: 'ekskavator', name: '🥄 Ekskavator Sendok', emoji: '🥄' },
        { id: 'pinset_dental', name: '🥢 Pinset Dental Bengkok', emoji: '🥢' },
        { id: 'cement_spatula', name: '🔪 Cement Spatula', emoji: '🔪' },
    ],
    epic: [
        { id: 'tang_cabut', name: '🦷 Tang Cabut Mahkota', emoji: '⚙️' },
        { id: 'bein_lurus', name: '🗡️ Bein Lurus Tajam', emoji: '🗡️' },
        { id: 'mikromotor', name: '🔧 Mikromotor Low Speed', emoji: '🔧' },
        { id: 'articulator', name: '👄 Articulator', emoji: '👄' },
    ],
    legendary: [
        { id: 'dental_unit', name: '💺 Dental Unit Sultan (Full Spec)', emoji: '💺' },
        { id: 'light_cure', name: '🔦 Light Cure LED Turbo', emoji: '🔦' },
        { id: 'autoclave', name: '♨️ Autoclave Sterilizer', emoji: '♨️' },
    ]
};

module.exports = {
    name: 'gacha',
    description: 'Gacha berbayar (500 Gold/Pull)',
    async execute(message, args) {
        const subCommand = args[0]?.toLowerCase();

        // --- SUB-COMMAND: INVENTORY (Cek Tas) ---
        if (subCommand === 'tas' || subCommand === 'inv') {
            let user = await User.findOne({ userId: message.author.id });
            
            // Handle jika user belum pernah main
            if (!user || !user.inventory || user.inventory.length === 0) {
                return message.reply('🎒 Tas kamu masih kosong. Cari uang dulu pakai `!daily`, lalu `!gacha`!');
            }

            // Hitung jumlah item per rarity
            const counts = { Legendary: 0, Epic: 0, Rare: 0, Common: 0 };
            user.inventory.forEach(item => {
                if (counts[item.rarity] !== undefined) counts[item.rarity]++;
            });

            // Tampilkan 5 item terakhir yang didapat
            const lastItems = user.inventory.slice(-5).reverse()
                .map(i => `• ${i.rarity === 'Legendary' ? '🌟' : ''} **${i.itemName}** (${i.rarity})`)
                .join('\n');

            const embedInv = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`🎒 Inventory: ${message.author.username}`)
                .setDescription(`Total Item: **${user.inventory.length}**\n\n**Statistik Koleksi:**\n🌟 Legendary: ${counts.Legendary}\n🟣 Epic: ${counts.Epic}\n🔵 Rare: ${counts.Rare}\n⚪ Common: ${counts.Common}\n\n**5 Item Terakhir Didapat:**\n${lastItems}`)
                .setFooter({ text: 'Kumpulkan semua item Legendary!' });

            return message.reply({ embeds: [embedInv] });
        }

        // --- LOGIKA GACHA PULL ---
        
        const HARGA_GACHA = 500; // Harga per pull

        // 1. Ambil Data User
        let user = await User.findOne({ userId: message.author.id });
        if (!user) {
             // Buat user baru dengan modal awal 1000 Gold
             user = await User.create({ 
                 userId: message.author.id, 
                 username: message.author.username, 
                 inventory: [],
                 gold: 1000 
             });
        }

        // 2. CEK SALDO (Cukup gak?)
        // Pastikan field gold ada, kalau undefined anggap 0
        const saldoUser = user.gold || 0;

        if (saldoUser < HARGA_GACHA) {
            return message.reply(`💸 **Uang Tidak Cukup!**\nBiaya Gacha: **${HARGA_GACHA} Gold**\nUangmu: **${saldoUser} Gold**\n\n*Tips: Ketik \`!daily\` untuk ambil gaji harian atau \`!duel\` untuk cari uang.*`);
        }

        // 3. POTONG SALDO
        user.gold -= HARGA_GACHA;

        // 4. LOGIKA RANDOM (RNG)
        const rand = Math.random() * 100; // Angka 0 - 100
        let rarity = '';
        let color = 0x000000;
        let pool = [];

        if (rand < 2) { // 2% chance
            rarity = 'Legendary';
            color = 0xF1C40F; // Emas
            pool = itemsPool.legendary;
        } else if (rand < 15) { // 13% chance (2+13)
            rarity = 'Epic';
            color = 0x9B59B6; // Ungu
            pool = itemsPool.epic;
        } else if (rand < 50) { // 35% chance (15+35)
            rarity = 'Rare';
            color = 0x3498DB; // Biru
            pool = itemsPool.rare;
        } else { // 50% chance
            rarity = 'Common';
            color = 0xBDC3C7; // Abu-abu
            pool = itemsPool.common;
        }

        // Pilih item acak dari pool rarity
        const gainedItem = pool[Math.floor(Math.random() * pool.length)];

        // 5. SIMPAN ITEM & UPDATE SALDO KE DATABASE
        user.inventory.push({
            itemId: gainedItem.id,
            itemName: gainedItem.emoji + ' ' + gainedItem.name,
            rarity: rarity
        });
        
        await user.save(); // Simpan perubahan (Gold berkurang + Item bertambah)

        // 6. TAMPILKAN HASIL
        const embedGacha = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🎁 GACHA RESULT!`)
            .setDescription(`Selamat **${message.author.username}**! Kamu mendapatkan:\n\n# ${gainedItem.emoji} **${gainedItem.name}**\n\n⭐ Rarity: **${rarity.toUpperCase()}**`)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: `Sisa Uang: ${user.gold} Gold | Cek tas: !gacha tas` });

        // Efek visual tambahan jika dapat Legendary
        if (rarity === 'Legendary') {
            await message.channel.send(`🎉🎉 **WOAH! HOKI PARAH! ${message.author} DAPAT LEGENDARY!** 🎉🎉`);
        }

        await message.reply({ embeds: [embedGacha] });
    },
};