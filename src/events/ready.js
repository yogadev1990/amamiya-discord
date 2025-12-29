module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ Siap! Login sebagai ${client.user.tag}`);
        console.log(`💻 Sedang berjalan di ${client.guilds.cache.size} server.`);
        
        // Set status bot (Playing/Watching)
        client.user.setActivity('Menunggu Perintah !menu', { type: 4 }); // 4 = Custom Status
    },
};