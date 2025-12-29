module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // 1. Abaikan pesan dari bot lain
        if (message.author.bot) return;

        // 2. Tentukan Prefix (Awalan perintah)
        const prefix = '!'; 

        // 3. Cek apakah pesan diawali prefix
        if (!message.content.startsWith(prefix)) return;

        // 4. Pisahkan command dan argumen (Contoh: "!halo dunia" -> command="halo", args=["dunia"])
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // 5. Cari command di koleksi
        const command = client.commands.get(commandName);

        if (!command) return; // Jika command tidak ditemukan, diam saja

        // 6. Jalankan command
        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            await message.reply('❌ Ada error saat menjalankan perintah ini!');
        }
    },
};