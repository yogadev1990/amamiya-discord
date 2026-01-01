const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'transfer',
    description: 'Kirim Gold ke user lain. Pajak admin 5%.',
    async execute(message, args) {
        // Format: !transfer @user [jumlah]
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        // --- VALIDASI ---
        if (!target) return message.reply("❌ Mau kirim ke siapa? Tag orangnya.\nContoh: `!transfer @Budi 100`");
        if (!amount || isNaN(amount) || amount <= 0) return message.reply("❌ Masukkan jumlah uang yang valid.");
        if (target.id === message.author.id) return message.reply("❌ Gak bisa kirim ke diri sendiri (Cuci uang ya?).");
        if (target.bot) return message.reply("🤖 Robot tidak butuh uang.");

        // --- DATABASE ---
        const sender = await User.findOne({ userId: message.author.id });
        const receiver = await User.findOne({ userId: target.id });

        if (!sender || sender.gold < amount) {
            return message.reply(`💸 **Saldo Kurang!**\nUangmu cuma: ${sender ? sender.gold : 0} Gold.`);
        }

        // Kalau penerima belum main (belum ada di DB), buatkan akun
        if (!receiver) {
            await User.create({ userId: target.id, username: target.username, gold: 0 });
            // Fetch ulang biar variabel 'receiver' ada isinya
            receiver = await User.findOne({ userId: target.id });
        }

        // --- PAJAK (Opsional, biar ekonomi gak inflasi) ---
        const taxRate = 0.05; // 5%
        const tax = Math.floor(amount * taxRate);
        const finalAmount = amount - tax;

        // --- TRANSAKSI ---
        sender.gold -= amount;
        receiver.gold += finalAmount;

        await sender.save();
        await receiver.save();

        // --- LOG ---
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('💸 TRANSFER BERHASIL')
            .addFields(
                { name: 'Pengirim', value: `${message.author.username}`, inline: true },
                { name: 'Penerima', value: `${target.username}`, inline: true },
                { name: 'Nominal', value: `${amount} Gold`, inline: true },
                { name: 'Diterima', value: `**${finalAmount} Gold**\n*(Potongan pajak ${tax})*`, inline: true }
            )
            .setFooter({ text: `Sisa Saldo: ${sender.gold} Gold` });

        message.reply({ embeds: [embed] });
    },
};