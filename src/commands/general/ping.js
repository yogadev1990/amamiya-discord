module.exports = {
    name: 'ping', // Cara pakainya: !ping
    description: 'Balas dengan Pong!',
    async execute(message, args) {
        await message.reply('🏓 Pong! Bot merespon dengan baik.');
    },
};