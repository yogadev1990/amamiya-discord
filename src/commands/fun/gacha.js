const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../shared/models/User');

// --- DATABASE ITEM GACHA ---
const itemsPool = {
    common: [
        { id: 'masker_bedah', name: 'Masker Bedah Ijo', emoji: '😷' },
        { id: 'handscoon', name: 'Handscoon Sobek Dikit', emoji: '🧤' },
        { id: 'cotton_roll', name: 'Cotton Roll Basah', emoji: '☁️' },
        { id: 'gelas_kumur', name: 'Gelas Kumur Plastik', emoji: '🥤' },
        { id: 'dental_bib', name: 'Dental Bib', emoji: '🧻' },
    ],
    rare: [
        { id: 'kaca_mulut', name: 'Kaca Mulut No. 4', emoji: '🔍' },
        { id: 'sonde_half', name: 'Sonde Half Moon', emoji: '🪝' },
        { id: 'ekskavator', name: 'Ekskavator Sendok', emoji: '🥄' },
        { id: 'pinset_dental', name: 'Pinset Dental Bengkok', emoji: '🥢' },
        { id: 'cement_spatula', name: 'Cement Spatula', emoji: '🔪' },
    ],
    epic: [
        { id: 'tang_cabut', name: 'Tang Cabut Mahkota', emoji: '⚙️' },
        { id: 'bein_lurus', name: 'Bein Lurus Tajam', emoji: '🗡️' },
        { id: 'mikromotor', name: 'Mikromotor Low Speed', emoji: '🔧' },
        { id: 'articulator', name: 'Articulator', emoji: '👄' },
    ],
    legendary: [
        { id: 'dental_unit', name: 'Dental Unit Sultan (Full Spec)', emoji: '💺' },
        { id: 'light_cure', name: 'Light Cure LED Turbo', emoji: '🔦' },
        { id: 'autoclave', name: 'Autoclave Sterilizer', emoji: '♨️' },
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gacha')
        .setDescription('Gacha berbayar (500 Gold/Pull)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('pull')
                .setDescription('Gacha item dental (500 Gold)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tas')
                .setDescription('Lihat isi tas (inventory) kamu')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lihat daftar hadiah dan drop rate')
        ),
    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();

        if (subCommand === 'tas') {
            let user = await User.findOne({ userId: interaction.user.id });
            
            if (!user || !user.inventory || user.inventory.length === 0) {
                return interaction.reply('🎒 Tas kamu masih kosong. Cari uang dulu pakai `/daily`, lalu `/gacha pull`!');
            }

            const counts = { Legendary: 0, Epic: 0, Rare: 0, Common: 0 };
            user.inventory.forEach(item => {
                if (counts[item.rarity] !== undefined) counts[item.rarity]++;
            });

            const lastItems = user.inventory.slice(-5).reverse()
                .map(i => `• ${i.rarity === 'Legendary' ? '🌟' : ''} **${i.itemName}** (${i.rarity})`)
                .join('\n');

            const embedInv = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(`🎒 Inventory: ${interaction.user.username}`)
                .setDescription(`Total Item: **${user.inventory.length}**\n\n**Statistik Koleksi:**\n🌟 Legendary: ${counts.Legendary}\n🟣 Epic: ${counts.Epic}\n🔵 Rare: ${counts.Rare}\n⚪ Common: ${counts.Common}\n\n**5 Item Terakhir Didapat:**\n${lastItems}`)
                .setFooter({ text: 'Kumpulkan semua item Legendary!' });

            return interaction.reply({ embeds: [embedInv] });
        }

        if (subCommand === 'list') {
            const embedList = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('📜 DAFTAR HADIAH & DROP RATE')
                .setDescription('Berikut adalah daftar item dental yang bisa kamu dapatkan dari mesin gacha ini.')
                .addFields(
                    { 
                        name: '🌟 LEGENDARY (Chance: 2%)', 
                        value: itemsPool.legendary.map(i => `${i.emoji} ${i.name}`).join('\n'),
                        inline: false 
                    },
                    { 
                        name: '🟣 EPIC (Chance: 13%)', 
                        value: itemsPool.epic.map(i => `${i.emoji} ${i.name}`).join('\n'),
                        inline: false 
                    },
                    { 
                        name: '🔵 RARE (Chance: 35%)', 
                        value: itemsPool.rare.map(i => `${i.emoji} ${i.name}`).join('\n'),
                        inline: false 
                    },
                    { 
                        name: '⚪ COMMON (Chance: 50%)', 
                        value: itemsPool.common.map(i => `${i.emoji} ${i.name}`).join('\n'),
                        inline: false 
                    }
                )
                .setFooter({ text: 'Biaya: 500 Gold per putaran. Good Luck!' });

            return interaction.reply({ embeds: [embedList] });
        }

        if (subCommand === 'pull') {
            const HARGA_GACHA = 500; 

            let user = await User.findOne({ userId: interaction.user.id });
            if (!user) {
                 user = await User.create({ 
                     userId: interaction.user.id, 
                     username: interaction.user.username, 
                     inventory: [],
                     gold: 1000 
                 });
            }

            const saldoUser = user.gold || 0;
            if (saldoUser < HARGA_GACHA) {
                return interaction.reply(`💸 **Uang Tidak Cukup!**\nBiaya Gacha: **${HARGA_GACHA} Gold**\nUangmu: **${saldoUser} Gold**\n\n*Tips: Ketik \`/daily\` atau \`/duel\` untuk cari uang.*`);
            }

            user.gold -= HARGA_GACHA;

            const rand = Math.random() * 100;
            let rarity = '';
            let color = 0x000000;
            let pool = [];

            if (rand < 2) { // 2%
                rarity = 'Legendary';
                color = 0xF1C40F; 
                pool = itemsPool.legendary;
            } else if (rand < 15) { // 13%
                rarity = 'Epic';
                color = 0x9B59B6; 
                pool = itemsPool.epic;
            } else if (rand < 50) { // 35%
                rarity = 'Rare';
                color = 0x3498DB; 
                pool = itemsPool.rare;
            } else { // 50%
                rarity = 'Common';
                color = 0xBDC3C7; 
                pool = itemsPool.common;
            }

            const gainedItem = pool[Math.floor(Math.random() * pool.length)];

            user.inventory.push({
                itemId: gainedItem.id,
                itemName: gainedItem.emoji + ' ' + gainedItem.name,
                rarity: rarity
            });
            
            await user.save(); 

            const embedGacha = new EmbedBuilder()
                .setColor(color)
                .setTitle(`🎁 GACHA RESULT!`)
                .setDescription(`Selamat **${interaction.user.username}**! Kamu mendapatkan:\n\n# ${gainedItem.emoji} **${gainedItem.name}**\n\n⭐ Rarity: **${rarity.toUpperCase()}**`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: `Sisa Uang: ${user.gold} Gold | Cek list: /gacha list` });

            if (rarity === 'Legendary') {
                await interaction.channel.send(`🎉🎉 **WOAH! HOKI PARAH! ${interaction.user} DAPAT LEGENDARY!** 🎉🎉`);
            }

            await interaction.reply({ embeds: [embedGacha] });
        }
    },
};
