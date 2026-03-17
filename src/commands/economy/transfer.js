const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Kirim saldo Gold ke pengguna lain (Dikenakan pajak sistem 5%)')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Pilih mahasiswa penerima dana')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('nominal')
                .setDescription('Jumlah Gold yang akan dikirim')
                .setRequired(true)
                .setMinValue(1) // Mencegah eksploitasi transfer minus
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('target');
        const amount = interaction.options.getInteger('nominal');

        // --- VALIDASI ENTITAS ---
        if (target.id === interaction.user.id) return interaction.editReply("❌ **Peringatan Keamanan:** Sistem mendeteksi upaya pencucian uang. Anda tidak bisa mentransfer ke diri sendiri.");
        if (target.bot) return interaction.editReply("🤖 **Sistem Menolak:** Entitas AI beroperasi tanpa membutuhkan sistem moneter manusia.");

        try {
            // --- EKSEKUSI DATABASE ---
            const sender = await User.findOne({ userId: interaction.user.id });
            if (!sender || sender.gold < amount) {
                return interaction.editReply(`💸 **Saldo Defisit!**\nSisa saldo Anda: **${sender ? sender.gold : 0} Gold**.\nNominal transfer: **${amount} Gold**.`);
            }

            let receiver = await User.findOne({ userId: target.id });
            if (!receiver) {
                receiver = new User({ userId: target.id, username: target.username, gold: 0, inventory: [] });
            }

            // --- KALKULASI PAJAK MUTLAK ---
            const taxRate = 0.05; // Pajak 5%
            const tax = Math.floor(amount * taxRate);
            const finalAmount = amount - tax;

            // --- TRANSAKSI ---
            sender.gold -= amount;
            receiver.gold += finalAmount;

            await sender.save();
            await receiver.save();

            // --- RENDER ANTARMUKA FAKTUR ---
            const embedSuccess = new EmbedBuilder()
                .setColor('#2ECC71') // Hijau Keuangan
                .setTitle('💳 FAKTUR TRANSFER BERHASIL')
                .setDescription(`Dana telah dipindahkan secara aman dari rekening **${interaction.user.username}** ke rekening **${target.username}**.`)
                .addFields(
                    { name: '📤 Nominal Dikirim', value: `${amount} Gold`, inline: true },
                    { name: '📉 Potongan Pajak (5%)', value: `-${tax} Gold`, inline: true },
                    { name: '📥 Diterima Bersih', value: `**${finalAmount} Gold**`, inline: false }
                )
                .setFooter({ 
                    text: `Sisa Saldo Anda: ${sender.gold} Gold`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embedSuccess] });

        } catch (error) {
            console.error("Kesalahan Sistem Perbankan:", error);
            await interaction.editReply("❌ **Sistem Gagal:** Terjadi anomali saat menghubungi bank sentral server.");
        }
    },
};
