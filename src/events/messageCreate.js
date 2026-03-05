module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // 1. Abaikan jika bukan command
        if (!interaction.isCommand()) return;

        // 2. Ambil nama command
        const command = client.commands.get(interaction.commandName);

        if (!command) return; // Jika command tidak ditemukan, diam saja

        // 3. Jalankan command
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: '❌ Ada error saat menjalankan perintah ini!',
                ephemeral: true
            });
        }
    },
};