module.exports = {
    name: 'sapa',
    description: 'Menyapa seseorang',
    async execute(message, args) {
        // args[0] adalah kata pertama setelah !sapa
        if (!args.length) {
            return message.reply('Siapa yang harus ku sapa? Coba ketik: `!sapa [nama]`');
        }

        const nama = args.join(' ');
        await message.channel.send(`Halo, **${nama}**! Selamat datang di server ini 👋`);
    },
};